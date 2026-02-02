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

    constructor(private feedbackService: FeedbackService) { }

    toggleModal() {
        this.isOpen = !this.isOpen;
        this.successMessage = '';
        this.errorMessage = '';
    }

    async submit() {
        if (!this.feedbackText.trim()) return;

        this.isSubmitting = true;
        this.errorMessage = '';
        let blob: Blob | null = null;

        try {
            if (this.includeScreenshot) {
                // Capture everything except the feedback modal itself (optional optimization)
                // For simplicity, capture body. We temporarily hide modal to capture clean screen?
                // Or just capture as is.
                this.isOpen = false; // Hide to capture under
                // Wait for render
                await new Promise(r => setTimeout(r, 100));

                const canvas = await html2canvas(document.body);
                blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));

                this.isOpen = true; // Show again
            }

            await this.feedbackService.submitFeedback(this.feedbackText, blob);
            this.successMessage = 'Thanks for your feedback!';
            this.feedbackText = '';
            setTimeout(() => {
                this.isOpen = false;
                this.successMessage = '';
            }, 2000);
        } catch (e) {
            console.error(e);
            this.isOpen = true; // Ensure visible
            this.errorMessage = 'Failed to submit. Check internet or API Key.';
        } finally {
            this.isSubmitting = false;
        }
    }
}
