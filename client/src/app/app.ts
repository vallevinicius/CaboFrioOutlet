import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastStack } from './components/toast-stack/toast-stack';
import { SkipLink } from './components/skip-link/skip-link';
import { CookieConsent } from './components/cookie-consent/cookie-consent';
import { WhatsappButton } from './components/whatsapp-button/whatsapp-button';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastStack, WhatsappButton, CookieConsent, SkipLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
