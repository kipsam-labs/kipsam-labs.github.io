import { Component, ViewEncapsulation, HostListener } from '@angular/core';
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

    @HostListener('document:mousemove', ['$event'])
    onMouseMove(e: MouseEvent) {
        const doc = document.documentElement;
        doc.style.setProperty('--mouse-x', `${e.clientX}px`);
        doc.style.setProperty('--mouse-y', `${e.clientY}px`);
    }
}
