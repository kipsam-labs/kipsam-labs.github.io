import { Routes } from '@angular/router';
import { LandingComponent } from './landing/landing';
import { CameraComponent } from './camera/camera';
import { PrivacyPolicyComponent } from './privacy-policy/privacy-policy';

export const routes: Routes = [
    { path: '', component: LandingComponent },
    { path: 'camera', component: CameraComponent },
    { path: 'privacy-policy', component: PrivacyPolicyComponent },
    { path: '**', redirectTo: '' }
];
