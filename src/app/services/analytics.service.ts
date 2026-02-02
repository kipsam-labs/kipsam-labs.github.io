import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class AnalyticsService {

    constructor() { }

    logEvent(eventName: string, params?: any) {
        console.log(`[Analytics] ${eventName}`, params);
        // TODO: Connect to Google Analytics or Firebase
    }

    logPageView(page: string) {
        console.log(`[Analytics] Page View: ${page}`);
    }
}
