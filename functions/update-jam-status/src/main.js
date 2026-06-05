const sdk = require('node-appwrite');

const DATABASE_ID = 'konfitur-db';
const COLLECTION_ID = 'game_jams';
const PAGE_SIZE = 25;

/**
 * Calcule le statut attendu d'une jam selon les dates actuelles.
 * @param {string} startDate - ISO string
 * @param {string} endDate   - ISO string
 * @param {Date}   now
 * @returns {'upcoming'|'ongoing'|'ended'}
 */
function computeExpectedStatus(startDate, endDate, now) {
  if (now >= new Date(endDate)) return 'ended';
  if (now >= new Date(startDate)) return 'ongoing';
  return 'upcoming';
}

module.exports = async ({ req, res, log, error }) => {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    error('Variables d\'env manquantes : APPWRITE_ENDPOINT, APPWRITE_FUNCTION_PROJECT_ID, APPWRITE_API_KEY');
    return res.json({ success: false, message: 'Configuration incomplète' }, 500);
  }

  const client = new sdk.Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new sdk.Databases(client);
  const now = new Date();

  let updatedCount = 0;
  let errorCount = 0;
  let cursor = null;
  let hasMore = true;

  log(`Début de la mise à jour des statuts — ${now.toISOString()}`);

  while (hasMore) {
    const queries = [
      sdk.Query.notEqual('status', 'ended'),
      sdk.Query.limit(PAGE_SIZE),
    ];

    if (cursor) {
      queries.push(sdk.Query.cursorAfter(cursor));
    }

    let page;
    try {
      page = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, queries);
    } catch (err) {
      error(`Erreur lors de la récupération des jams : ${err.message}`);
      return res.json({ success: false, message: 'Erreur lecture base de données' }, 500);
    }

    const documents = page.documents;

    for (const jam of documents) {
      const expected = computeExpectedStatus(jam.start_date, jam.end_date, now);

      if (expected === jam.status) continue;

      try {
        await databases.updateDocument(DATABASE_ID, COLLECTION_ID, jam.$id, {
          status: expected,
        });
        log(`[OK] Jam "${jam.$id}" : ${jam.status} -> ${expected}`);
        updatedCount++;
      } catch (err) {
        error(`[ERREUR] Jam "${jam.$id}" : impossible de mettre à jour — ${err.message}`);
        errorCount++;
      }
    }

    if (documents.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      cursor = documents[documents.length - 1].$id;
    }
  }

  log(`Terminé — ${updatedCount} jam(s) mise(s) à jour, ${errorCount} erreur(s)`);

  return res.json({
    success: true,
    updated: updatedCount,
    errors: errorCount,
    timestamp: now.toISOString(),
  });
};
