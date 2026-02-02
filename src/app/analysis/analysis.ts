import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
// @ts-ignore
import * as piexif from 'piexifjs';

@Component({
    selector: 'app-analysis',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './analysis.html',
    styleUrls: ['./analysis.css']
})
export class AnalysisComponent implements OnInit {
    constructor(private cdr: ChangeDetectorRef) { }
    selectedImage: string | null = null;
    metadata: any = null;
    map: L.Map | null = null;
    marker: L.Marker | null = null;
    error: string | null = null;

    ngOnInit() {
        // Icon fix for Leaflet in Angular
        const iconRetinaUrl = 'assets/marker-icon-2x.png';
        const iconUrl = 'assets/marker-icon.png';
        const shadowUrl = 'assets/marker-shadow.png';
        const iconDefault = L.icon({
            iconRetinaUrl,
            iconUrl,
            shadowUrl,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            tooltipAnchor: [16, -28],
            shadowSize: [41, 41]
        });
        L.Marker.prototype.options.icon = iconDefault;
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e: any) => {
                this.selectedImage = e.target.result;
                this.analyzeImage(this.selectedImage as string);
            };
            reader.readAsDataURL(file);
        }
    }

    analyzeImage(dataUrl: string) {
        console.log('Analyzing image...');
        this.error = null;
        this.metadata = {};

        try {
            console.log('Loading EXIF data...');
            const exifObj = piexif.load(dataUrl);
            console.log('EXIF loaded:', exifObj);

            const gps = exifObj['GPS'];
            console.log('GPS Data:', gps);

            if (!gps || !Object.keys(gps).length) {
                this.error = "No GPS metadata found in this image.";
                console.warn(this.error);
                alert(this.error); // Alert user directly
                return;
            }

            // Extract GPS
            const lat = this.dmsToDecimal(gps[piexif.GPSIFD.GPSLatitude], gps[piexif.GPSIFD.GPSLatitudeRef]);
            const lng = this.dmsToDecimal(gps[piexif.GPSIFD.GPSLongitude], gps[piexif.GPSIFD.GPSLongitudeRef]);
            // const alt = gps[piexif.GPSIFD.GPSAltitude] ? this.rationalToDecimal(gps[piexif.GPSIFD.GPSAltitude]) : 'N/A';

            console.log('Resolved Coordinates:', lat, lng);

            this.metadata = {
                latitude: lat,
                longitude: lng,
                // altitude: alt,
                dateTime: exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] || 'Unknown',
                camera: exifObj['0th'][piexif.ImageIFD.Model] || 'Unknown'
            };

            this.cdr.detectChanges(); // Force DOM update for *ngIf
            this.initMap(lat, lng);

        } catch (e: any) {
            console.error('Analysis Error:', e);
            this.error = "Failed to parse image data. Ensure it is a valid JPEG. Error: " + e.message;
            alert(this.error);
        }
    }

    dmsToDecimal(dms: number[][], ref: string): number {
        const d = dms[0][0] / dms[0][1];
        const m = dms[1][0] / dms[1][1];
        const s = dms[2][0] / dms[2][1];
        let decimal = d + (m / 60) + (s / 3600);

        if (ref === 'S' || ref === 'W') {
            decimal = decimal * -1;
        }
        return decimal;
    }

    rationalToDecimal(rational: number[]): number {
        return rational[0] / rational[1];
    }

    initMap(lat: number, lng: number) {
        if (this.map) {
            this.map.remove();
        }

        setTimeout(() => {
            const mapElement = document.getElementById('map');
            if (!mapElement) {
                console.error('Map element not found!');
                return;
            }

            this.map = L.map(mapElement).setView([lat, lng], 15);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);

            this.marker = L.marker([lat, lng]).addTo(this.map)
                .bindPopup(`<b>Photo Location</b><br>Lat: ${lat.toFixed(5)}<br>Long: ${lng.toFixed(5)}`)
                .openPopup();
        }, 100);
    }

    async shareAnalysis() {
        if (!this.metadata) return;

        const mapsLink = `https://www.google.com/maps?q=${this.metadata.latitude},${this.metadata.longitude}`;
        const shareData = {
            title: 'Photo Location Analysis',
            text: `📍 Captured at: ${this.metadata.latitude.toFixed(5)}, ${this.metadata.longitude.toFixed(5)}\n📅 Time: ${this.metadata.dateTime}\n🔗 View on Map:`,
            url: mapsLink
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
                alert('Link copied to clipboard!');
            }
        } catch (err) {
            console.error('Error sharing:', err);
        }
    }
}
