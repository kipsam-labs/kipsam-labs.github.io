import { Component, ViewEncapsulation } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-landing',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './landing.html',
    styleUrl: './landing.css',
    encapsulation: ViewEncapsulation.None
})
export class LandingComponent {

    constructor(private router: Router) { }

    startCamera() {
        this.router.navigate(['/camera']);
    }
}
