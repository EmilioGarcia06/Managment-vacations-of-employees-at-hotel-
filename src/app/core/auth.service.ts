import { Injectable, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { supabaseClient } from './supabase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly client = supabaseClient;
  readonly session = signal<Session | null>(null);
  readonly ready = signal(false);

  constructor() {
    this.client.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
    });
  }

  async initialize(): Promise<void> {
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      throw new Error(`No se pudo verificar la sesión: ${error.message}`);
    }

    this.session.set(data.session);
    this.ready.set(true);
  }

  async signIn(email: string, password: string): Promise<void> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      throw new Error('Correo o contraseña incorrectos.');
    }

    if (!data.session) {
      throw new Error('Supabase no devolvió una sesión válida.');
    }

    this.session.set(data.session);
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw new Error(`No se pudo cerrar la sesión: ${error.message}`);
    }
  }
}
