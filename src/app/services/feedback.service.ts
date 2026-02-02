import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class FeedbackService {
    private app: any;
    private db: any;
    private storage: any;
    private isInitialized = false;

    constructor() {
        this.initFirebase();
    }

    private initFirebase() {
        if (environment.firebase.apiKey === "YOUR_API_KEY_HERE") {
            console.warn("Firebase API Key is missing. Feedback service will not work.");
            return;
        }
        try {
            this.app = initializeApp(environment.firebase);
            this.db = getFirestore(this.app);
            this.storage = getStorage(this.app);
            this.isInitialized = true;
        } catch (e) {
            console.error("Firebase init failed", e);
        }
    }

    async submitFeedback(text: string, imageBlob: Blob | null): Promise<void> {
        if (!this.isInitialized) throw new Error("Firebase not configured");

        let imageUrl = '';

        if (imageBlob) {
            const filename = `feedback_${Date.now()}.jpg`;
            const storageRef = ref(this.storage, `feedback_screenshots/${filename}`);
            const snapshot = await uploadBytes(storageRef, imageBlob);
            imageUrl = await getDownloadURL(snapshot.ref);
        }

        await addDoc(collection(this.db, "feedback"), {
            text: text,
            screenshotUrl: imageUrl,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent,
            url: window.location.href
        });
    }
}
