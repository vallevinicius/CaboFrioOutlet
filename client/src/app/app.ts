import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastStack } from './components/toast-stack/toast-stack';
import { WhatsappButton } from './components/whatsapp-button/whatsapp-button';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastStack, WhatsappButton],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
