import HomeClient from "./HomeClient";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const dynamic = "force-dynamic";

export default async function Page() {
  let initialSettings = null;
  try {
    const docRef = doc(db, "settings", "general");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      initialSettings = docSnap.data();
    }
  } catch (error) {
    console.error("Error pre-fetching initial settings on server:", error);
  }

  return <HomeClient initialSettings={initialSettings} />;
}
