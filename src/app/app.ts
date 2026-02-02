import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FeedbackComponent } from './feedback/feedback.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FeedbackComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('gps-camera-app');
}
