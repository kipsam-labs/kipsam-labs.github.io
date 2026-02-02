import { Component, ElementRef, OnInit, ViewChild, OnDestroy, AfterViewInit } from '@angular/core';
// @ts-ignore
import * as piexif from 'piexifjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeedbackComponent } from '../feedback/feedback.component';

@Component({
  selector: 'app-camera',
  standalone: true,
  imports: [CommonModule, FormsModule, FeedbackComponent],
  templateUrl: './camera.html',
  styleUrl: './camera.css'
})
export class CameraComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  locationData: {
    latitude: number;
    longitude: number;
    address?: string;
    altitude?: number | null;
    accuracy?: number | null;
    heading?: number | null;
  } | null = null;
  // Errors
  cameraError: string | null = null;
  gpsError: string | null = null;
  stream: MediaStream | null = null;

  // Orientation
  currentHeading: number = 0;

  // Configurable Fields
  customNote1: string = '';
  customNote2: string = '';
  overlayPosition: 'top' | 'bottom' = 'bottom';
  showSettings: boolean = false;
  showAddress: boolean = true; // New Toggle

  // Zoom
  zoomLevel: number = 1;
  minZoom: number = 1;
  maxZoom: number = 1;
  zoomSupported: boolean = false;
  zoomStep: number = 0.1;

  // Camera Switch
  facingMode: 'environment' | 'user' = 'environment';

  // Flash/Torch
  flashSupported: boolean = false;
  flashOn: boolean = false;

  // Video Recording
  mediaRecorder: MediaRecorder | null = null;
  recordedChunks: Blob[] = [];
  isRecording: boolean = false;

  // Animation Loop
  private animationFrameId: number | null = null;
  private isDestroyed: boolean = false;

  ngOnInit(): void {
    this.initLocation();
    this.initCompass();
  }

  ngAfterViewInit(): void {
    this.initCamera();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  toggleSettings() {
    this.showSettings = !this.showSettings;
  }

  async initCamera() {
    this.cameraError = null;
    try {
      // Request 4:3 aspect ratio (standard photo sensor) to prevent driver-side cropping
      // and high resolution for clarity.
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.facingMode,
          aspectRatio: { ideal: 1.333 }, // 4:3 aspect ratio
          width: { ideal: 4096 },
          height: { ideal: 3072 }
        },
        audio: true
      });

      if (!this.videoElement?.nativeElement) {
        console.error('Video element not found');
        return;
      }

      const video = this.videoElement.nativeElement;
      video.muted = true; // Force mute to prevent feedback
      video.srcObject = this.stream;
      video.play().catch(e => console.error('Video play error:', e));

      // Check for Zoom Capabilities
      const track = this.stream.getVideoTracks()[0];

      // Safe check for capabilities
      if (typeof track.getCapabilities === 'function') {
        const capabilities = track.getCapabilities() as any;
        if (capabilities && capabilities.zoom) {
          this.zoomSupported = true;
          this.minZoom = capabilities.zoom.min;
          this.maxZoom = capabilities.zoom.max;
          this.zoomStep = capabilities.zoom.step;
          this.zoomLevel = this.minZoom;
        }
        // Check for flash/torch support
        if (capabilities && capabilities.torch) {
          this.flashSupported = true;
        }
      }

      video.onloadedmetadata = () => {
        this.startCanvasLoop();
      };
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      this.cameraError = `Camera Access Error: ${err.message || 'Unknown error'}`;
    }
  }

  retryCamera() {
    this.initCamera();
  }

  // Switch between front and back camera
  async switchCamera() {
    // Stop current stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    // Toggle facing mode
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';

    // Reset flash state since we're changing cameras
    this.flashOn = false;
    this.flashSupported = false;

    // Reinitialize camera
    await this.initCamera();
  }

  // Toggle flash/torch
  async toggleFlash() {
    if (!this.stream || !this.flashSupported) return;

    const track = this.stream.getVideoTracks()[0];
    this.flashOn = !this.flashOn;

    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: this.flashOn }]
      });
    } catch (err) {
      console.error('Flash toggle error:', err);
      this.flashOn = false;
    }
  }

  dismissGpsError() {
    this.gpsError = null;
  }

  setZoom(event: any) {
    const value = parseFloat(event.target.value);
    this.zoomLevel = value;

    if (this.stream) {
      const track = this.stream.getVideoTracks()[0];
      // Type assertion for advanced constraints
      (track as any).applyConstraints({
        advanced: [{ zoom: value }]
      }).catch((err: any) => console.error('Zoom error', err));
    }
  }

  initCompass() {
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (event: DeviceOrientationEvent) => {
        console.log('Heading Event:', event.alpha, (event as any).webkitCompassHeading);
        // iOS requires 'webkitCompassHeading'
        // Android/Standard uses 'alpha' (0-360)
        let heading = null;

        if ((event as any).webkitCompassHeading) {
          heading = (event as any).webkitCompassHeading;
        } else if (event.alpha !== null) {
          heading = 360 - event.alpha; // Convert counter-clockwise to clockwise
        }

        if (heading !== null) {
          this.currentHeading = heading;
          if (this.locationData) {
            this.locationData.heading = heading;
          }
        }
      }, true);
    }
  }

  initLocation() {
    if ('geolocation' in navigator) {
      navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const long = position.coords.longitude;
          const alt = position.coords.altitude;
          const acc = position.coords.accuracy;

          let address = this.locationData?.address || '';
          if (!this.locationData || Math.abs(this.locationData.latitude - lat) > 0.0001) {
            address = await this.reverseGeocode(lat, long);
          }

          this.locationData = {
            latitude: lat,
            longitude: long,
            address: address,
            altitude: alt,
            accuracy: acc,
            heading: this.currentHeading
          };
          this.gpsError = null;
        },
        (error) => {
          console.error('Error getting location:', error);
          this.gpsError = 'GPS Access Denied. Location tags disabled.';
        },
        { enableHighAccuracy: true }
      );
    } else {
      this.gpsError = 'Geolocation not supported by this browser.';
    }
  }

  async reverseGeocode(lat: number, long: number): Promise<string> {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${long}`);
      const data = await response.json();

      if (data.address) {
        // Construct a shorter address
        const parts = [];
        if (data.address.road) parts.push(data.address.road);
        if (data.address.suburb) parts.push(data.address.suburb);
        else if (data.address.neighbourhood) parts.push(data.address.neighbourhood);

        if (data.address.city) parts.push(data.address.city);
        else if (data.address.town) parts.push(data.address.town);
        else if (data.address.village) parts.push(data.address.village);

        if (data.address.state) parts.push(data.address.state);

        return parts.join(', ');
      }

      return data.display_name?.split(',').slice(0, 3).join(',') || 'Address not found';
    } catch (e) {
      console.warn('Geocoding failed', e);
      return '';
    }
  }

  startCanvasLoop() {
    if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) return;

    // Prevent multiple loops
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');

    const loop = () => {
      // Check again inside loop in case component destroyed or canvas detached from DOM
      if (this.isDestroyed || !this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) return;

      // Safety check: if canvas is no longer in the DOM, stop the loop
      if (!canvas.isConnected) {
        this.isDestroyed = true;
        return;
      }

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        // 1. Set Canvas size to Display size (Resolution independence)
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;
        }

        // 2. Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 3. Calculate Scale to Show Full Field of View (Natural)
        const videoRatio = video.videoWidth / video.videoHeight;
        const canvasRatio = canvas.width / canvas.height;

        let drawWidth, drawHeight, offsetX, offsetY;

        // Logic: "Contain" (Fit entire image)
        if (canvasRatio > videoRatio) {
          // Canvas is wider than video -> Match Height, Letterbox Sides
          drawHeight = canvas.height;
          drawWidth = canvas.height * videoRatio;
          offsetY = 0;
          offsetX = (canvas.width - drawWidth) / 2;
        } else {
          // Canvas is taller/narrower than video -> Match Width, Letterbox Top/Bottom
          drawWidth = canvas.width;
          drawHeight = canvas.width / videoRatio;
          offsetX = 0;
          offsetY = (canvas.height - drawHeight) / 2;
        }

        // 4. Draw Video (Centered & Scaled)
        ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

        // 5. Draw Overlay
        this.drawOverlay(ctx, canvas.width, canvas.height);
      }
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  drawOverlay(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Responsive Font Size
    const fontSize = Math.max(18, width / 45); // Slightly smaller for professional look
    const lineHeight = fontSize * 1.4;
    const padding = 20;

    // Structured Data for Report
    const reportData = [];

    // 1. Date (Bold Label)
    reportData.push({ label: 'Date:', value: new Date().toLocaleString() });

    // 2. Location
    if (this.locationData) {
      const loc = this.locationData;
      let locText = '';
      if (this.showAddress) {
        locText = loc.address || 'Address not found';
      } else {
        locText = `Lat: ${loc.latitude.toFixed(5)}, Long: ${loc.longitude.toFixed(5)}`;
      }
      reportData.push({ label: 'Location:', value: locText });
    }

    // 3. Notes
    if (this.customNote1) reportData.push({ label: 'Note:', value: this.customNote1 });
    if (this.customNote2) reportData.push({ label: 'Details:', value: this.customNote2 });

    // Calculate Box Height
    // multi-line location might need handling, but for now simple calculation
    // A simplified text wrap measurer would be ideal, but let's stick to simple first for robustness
    // assuming width is enough, or wrapping handles it. 

    // We need to pre-calculate lines to handle wrapping
    const maxWidth = width - (padding * 2);
    const finalLines: { text: string; isLabel?: boolean; xOffset?: number }[] = [];

    ctx.font = `bold ${fontSize}px Arial`; // Measure with bold for safety

    reportData.forEach(item => {
      // Label
      const labelWidth = ctx.measureText(item.label + ' ').width;

      // Wrap Value
      const valueWords = item.value.split(' ');
      let currentLine = '';

      // Push Label start
      finalLines.push({ text: item.label, isLabel: true, xOffset: 0 });

      // We will draw value on THE SAME LINE if it fits, else wrap
      // Actually, "Report Style" usually aligns value next to label.
      // Let's try to fit value next to label.

      let currentX = labelWidth;
      let isFirstWord = true;

      valueWords.forEach((word) => {
        const wordWidth = ctx.measureText(word + ' ').width;
        if (currentX + wordWidth < maxWidth) {
          currentLine += (isFirstWord ? '' : ' ') + word;
          currentX += wordWidth;
          isFirstWord = false;
        } else {
          // Push current line to "Value" stack for this row (but we simply push text objects)
          // This simple logic is getting complex for a valid single-pass draw.
          // Let's use a simpler "Label: Value" string approach but manual bolding.
        }
      });
    });

    // SIMPLIFIED APPROACH: Just render text, but handle formatting individually

    // Re-calculating needed height
    // Let's wrap lines properly first
    const drawnLines: { y: number; content: { text: string; bold: boolean; x: number }[] }[] = [];
    let currentY = 0;

    ctx.font = `normal ${fontSize}px Inter, Arial, sans-serif`;

    reportData.forEach(item => {
      const label = item.label + ' ';
      ctx.font = `bold ${fontSize}px Inter, Arial, sans-serif`;
      const labelWidth = ctx.measureText(label).width;

      const value = item.value;
      ctx.font = `normal ${fontSize}px Inter, Arial, sans-serif`;

      // Word Wrap the VALUE
      const words = value.split(' ');
      let line = '';
      let firstLine = true;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;

        const availableWidth = firstLine ? (maxWidth - labelWidth) : maxWidth;

        if (testWidth > availableWidth && n > 0) {
          // Flush Line
          drawnLines.push({
            y: currentY,
            content: firstLine
              ? [{ text: label, bold: true, x: 0 }, { text: line, bold: false, x: labelWidth }]
              : [{ text: line, bold: false, x: 0 }]
          });
          line = words[n] + ' ';
          currentY += lineHeight;
          firstLine = false;
        } else {
          line = testLine;
        }
      }
      // Flush Last Line
      drawnLines.push({
        y: currentY,
        content: firstLine
          ? [{ text: label, bold: true, x: 0 }, { text: line, bold: false, x: labelWidth }]
          : [{ text: line, bold: false, x: 0 }]
      });
      currentY += lineHeight; // New Line after each block
    });

    const boxHeight = currentY + (padding * 2);

    // Y Position (Bottom aligned)
    let boxY = height - boxHeight - padding - 20;
    if (this.overlayPosition === 'top') {
      boxY = padding + 20;
    }

    // Draw White Semi-Transparent Background
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; // Light Background
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 10;
    ctx.roundRect(padding, boxY, maxWidth + (padding), boxHeight, 12);
    ctx.fill();
    ctx.restore();

    // Draw Text
    ctx.fillStyle = '#1a1a1a'; // Dark Text
    ctx.textBaseline = 'top';

    drawnLines.forEach(line => {
      line.content.forEach(chunk => {
        ctx.font = `${chunk.bold ? 'bold' : 'normal'} ${fontSize}px Inter, Arial, sans-serif`;
        ctx.fillText(chunk.text.trim(), padding + padding / 2 + chunk.x, boxY + padding + line.y);
      });
    });
  }

  wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    let lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      let word = words[i];
      let width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth - 20) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  capturePhoto() {
    const canvas = this.canvasElement.nativeElement;
    let dataURL = canvas.toDataURL('image/jpeg', 1.0);

    if (this.locationData) {
      try {
        const lat = this.locationData.latitude;
        const lng = this.locationData.longitude;
        const alt = this.locationData.altitude;
        const heading = this.locationData.heading || this.currentHeading;

        const gpsIfd: any = {};

        // 1. Latitude/Longitude
        gpsIfd[piexif.GPSIFD.GPSLatitudeRef] = lat < 0 ? 'S' : 'N';
        gpsIfd[piexif.GPSIFD.GPSLatitude] = this.toDMS(lat);
        gpsIfd[piexif.GPSIFD.GPSLongitudeRef] = lng < 0 ? 'W' : 'E';
        gpsIfd[piexif.GPSIFD.GPSLongitude] = this.toDMS(lng);

        // 2. Altitude (Tag 6 = Altitude, 5 = AltRef)
        // AltRef: 0 = Above Sea Level, 1 = Below Sea Level
        if (alt !== null && alt !== undefined) {
          gpsIfd[piexif.GPSIFD.GPSAltitudeRef] = 0; // Assuming above sea level mostly
          gpsIfd[piexif.GPSIFD.GPSAltitude] = this.toRational(Math.abs(alt));
        }

        // 3. Image Direction (Tag 17 = ImgDirection, 16 = ImgDirectionRef)
        if (heading !== null) {
          gpsIfd[piexif.GPSIFD.GPSImgDirectionRef] = 'M'; // Magnetic North
          gpsIfd[piexif.GPSIFD.GPSImgDirection] = this.toRational(heading);
        }

        // 4. Time
        // DateStamp: YYYY:MM:DD, TimeStamp: fractional UTC
        const now = new Date();
        const gpsDate = now.toISOString().substring(0, 10).replace(/-/g, ':');
        gpsIfd[piexif.GPSIFD.GPSDateStamp] = gpsDate;

        gpsIfd[piexif.GPSIFD.GPSTimeStamp] = [
          [now.getUTCHours(), 1],
          [now.getUTCMinutes(), 1],
          [now.getUTCSeconds(), 1]
        ];

        // Construct EXIF
        const exifObj = {
          "0th": {
            [piexif.ImageIFD.Make]: "Kipsam Labs",
            [piexif.ImageIFD.Model]: "Web GPS Camera",
            [piexif.ImageIFD.Software]: "Kipsam Camera App v1.0"
          },
          "Exif": {
            [piexif.ExifIFD.DateTimeOriginal]: now.toISOString().replace(/[:-]/g, '').substring(0, 15),
          },
          "GPS": gpsIfd
        };

        const exifStr = piexif.dump(exifObj);
        dataURL = piexif.insert(exifStr, dataURL);
      } catch (e) {
        console.error('Error adding EXIF data', e);
      }
    }

    const link = document.createElement('a');
    link.download = `kipsam-labs_img_${Date.now()}.jpg`;
    link.href = dataURL;
    link.click();
  }

  // Helper for Rational [numerator, denominator]
  toRational(value: number): [number, number] {
    const denominator = 1000;
    const numerator = Math.round(value * denominator);
    return [numerator, denominator];
  }

  toDMS(coordinate: number): [[number, number], [number, number], [number, number]] {
    const absolute = Math.abs(coordinate);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60 * 100);

    return [[degrees, 1], [minutes, 1], [seconds, 100]];
  }

  toggleVideoRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  startRecording() {
    const canvas = this.canvasElement.nativeElement;
    const canvasStream = canvas.captureStream(30);

    // Create a new stream combining video from canvas and audio from microphone
    const combinedStream = new MediaStream([...canvasStream.getVideoTracks()]);

    if (this.stream) {
      this.stream.getAudioTracks().forEach(track => {
        if (track.enabled) combinedStream.addTrack(track);
        else console.warn('Audio track is disabled');
      });
    } else {
      console.warn('No audio stream available');
    }

    // Determine MIME type (try mp4 first for compatibility)
    const mimeTypes = ['video/mp4', 'video/webm; codecs=vp9,opus', 'video/webm'];
    let selectedMimeType = '';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedMimeType = type;
        break;
      }
    }

    this.recordedChunks = [];
    try {
      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: selectedMimeType || undefined,
        audioBitsPerSecond: 128000,
        videoBitsPerSecond: 2500000
      });
    } catch (e) {
      console.error('Record error:', e);
      return;
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) this.recordedChunks.push(event.data);
    };

    this.mediaRecorder.onstop = () => {
      const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      link.download = `kipsam-labs_vid_${Date.now()}.${ext}`;
      link.click();
      window.URL.revokeObjectURL(url);
    };

    this.mediaRecorder.start();
    this.isRecording = true;
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }
}
