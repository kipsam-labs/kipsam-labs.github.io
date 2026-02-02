import { Injectable } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class FeedbackService {
    private db: any;
    private storage: any;
    private isInitialized = false;
    private initError: string | null = null;

    constructor() {
        this.initFirebase();
    }

    private initFirebase() {
        if (!environment.firebase?.apiKey || environment.firebase.apiKey === "YOUR_API_KEY_HERE") {
            this.initError = "Firebase API Key is missing";
            console.warn("Firebase API Key is missing. Feedback service will not work.");
            return;
        }

        try {
            // Check if Firebase is already initialized
            let app;
            if (getApps().length === 0) {
                app = initializeApp(environment.firebase);
            } else {
                app = getApp();
            }

            this.db = getFirestore(app);
            this.storage = getStorage(app);
            this.isInitialized = true;
            console.log('FeedbackService: Firebase initialized successfully');
        } catch (e: any) {
            this.initError = e.message || 'Unknown Firebase error';
            console.error("Firebase init failed:", e);
        }
    }

    async submitFeedback(text: string, imageBlob: Blob | null): Promise<void> {
        if (!this.isInitialized) {
            throw new Error(this.initError || "Firebase not configured");
        }

        // Add timeout wrapper
        const withTimeout = <T>(promise: Promise<T>, ms: number, operation: string): Promise<T> => {
            return Promise.race([
                promise,
                new Promise<T>((_, reject) =>
                    setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
                )
            ]);
        };

        let imageUrl = '';

        try {
            if (imageBlob) {
                console.log('FeedbackService: Uploading screenshot...');
                const filename = `feedback_${Date.now()}.jpg`;
                const storageRef = ref(this.storage, `feedback_screenshots/${filename}`);

                const snapshot = await withTimeout(
                    uploadBytes(storageRef, imageBlob),
                    30000,
                    'Screenshot upload'
                );

                imageUrl = await withTimeout(
                    getDownloadURL(snapshot.ref),
                    10000,
                    'Get download URL'
                );
                console.log('FeedbackService: Screenshot uploaded');
            }

            console.log('FeedbackService: Saving feedback to Firestore...');
            await withTimeout(
                addDoc(collection(this.db, "feedback"), {
                    text: text,
                    screenshotUrl: imageUrl,
                    timestamp: serverTimestamp(),
                    userAgent: navigator.userAgent,
                    url: window.location.href
                }),
                15000,
                'Save to Firestore'
            );

            console.log('FeedbackService: Feedback submitted successfully');
        } catch (error: any) {
            console.error('FeedbackService error:', error);
            throw error;
        }
    }
}
