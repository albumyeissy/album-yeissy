import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(
  readFileSync(new URL("./service-account.json", import.meta.url))
);

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const fbAuth = getAuth();

async function main() {
  // Buscar UID de JC por email
  const jcUser = await fbAuth.getUserByEmail("jc@test.com");
  const jcUid = jcUser.uid;

  await db.doc(`usuarios/${jcUid}`).update({ monedas: FieldValue.increment(80) });
  console.log(`✅ JC (${jcUid}): +80 monedas`);

  const sergioUid = "WeGbuP8SzqU7WVxH6gQj8zAwDvK2";
  await db.doc(`usuarios/${sergioUid}`).update({ monedas: FieldValue.increment(40) });
  console.log(`✅ Sergio (${sergioUid}): +40 monedas`);

  console.log("✅ Listo");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
