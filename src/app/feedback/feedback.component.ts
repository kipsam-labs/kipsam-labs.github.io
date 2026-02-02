import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeedbackService } from '../services/feedback.service';
import html2canvas from 'html2canvas';

@Component({
    selector: 'app-feedback',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './feedback.component.html',
    styleUrl: './feedback.component.css'
})
export class FeedbackComponent {
    isOpen = false;
    feedbackText = '';
    includeScreenshot = true;
    isSubmitting = false;
    successMessage = '';
    errorMessage = '';
    private isCapturingScreenshot = false;

    constructor(private feedbackService: FeedbackService) { }

    toggleModal() {
        // Don't toggle if we're in the middle of capturing a screenshot
        if (this.isCapturingScreenshot) {
            return;
        }

        // If closing while submitting, cancel the submit state
        if (this.isOpen && this.isSubmitting) {
            this.isSubmitting = false;
        }

        this.isOpen = !this.isOpen;

        // Reset messages when opening fresh
        if (this.isOpen) {
            this.successMessage = '';
            this.errorMessage = '';
        }
    }

    async submit() {
        if (!this.feedbackText.trim() || this.isSubmitting) return;

        this.isSubmitting = true;
        this.errorMessage = '';
        let blob: Blob | null = null;

        try {
            if (this.includeScreenshot) {
                // Mark that we're capturing to prevent toggle during this phase
                this.isCapturingScreenshot = true;
                this.isOpen = false; // Hide to capture clean screen

                // Wait for render
                await new Promise(r => setTimeout(r, 150));

                try {
                    const canvas = await html2canvas(document.body, {
                        scale: 0.5,
                        logging: false,
                        useCORS: true
                    });
                    blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.4));
                } catch (screenshotError) {
                    console.warn('Screenshot capture failed, continuing without:', screenshotError);
                    // Continue without screenshot if capture fails
                }

                this.isOpen = true; // Show again
                this.isCapturingScreenshot = false;
            }

            await this.feedbackService.submitFeedback(this.feedbackText, blob);

            this.successMessage = 'Thanks for your feedback!';
            this.feedbackText = '';
            this.isSubmitting = false;

            setTimeout(() => {
                this.isOpen = false;
                this.successMessage = '';
            }, 2000);

        } catch (e: any) {
            console.error('Feedback submission error:', e);
            this.isCapturingScreenshot = false;
            this.isOpen = true; // Ensure visible
            this.isSubmitting = false;

            // Provide more specific error message
            if (e.message?.includes('Firebase not configured')) {
                this.errorMessage = 'Feedback service not available. Please try again later.';
            } else if (e.code === 'storage/unauthorized') {
                this.errorMessage = 'Permission denied. Please check Firebase settings.';
            } else {
                this.errorMessage = 'Failed to submit. Please check your internet connection.';
            }
        }
    }
}
