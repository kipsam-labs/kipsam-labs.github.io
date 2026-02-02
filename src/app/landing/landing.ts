import { Component, ViewEncapsulation, HostListener, OnInit } from '@angular/core';
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
export class LandingComponent implements OnInit {
    currentTheme: 'dark' | 'light' = 'dark';

    constructor(private router: Router) { }

    ngOnInit(): void {
        this.initTheme();
    }

    initTheme(): void {
        // Check localStorage first
        const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;

        if (savedTheme) {
            this.currentTheme = savedTheme;
        } else {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.currentTheme = prefersDark ? 'dark' : 'light';
        }

        this.applyTheme();

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                this.currentTheme = e.matches ? 'dark' : 'light';
                this.applyTheme();
            }
        });
    }

    toggleTheme(): void {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', this.currentTheme);
        this.applyTheme();
    }

    applyTheme(): void {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
    }

    startCamera(): void {
        this.router.navigate(['/camera']);
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove(e: MouseEvent): void {
        const doc = document.documentElement;
        doc.style.setProperty('--mouse-x', `${e.clientX}px`);
        doc.style.setProperty('--mouse-y', `${e.clientY}px`);
    }
}
