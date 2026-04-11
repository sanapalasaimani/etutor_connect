import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        signup: resolve(__dirname, 'signup.html'),
        blocked: resolve(__dirname, 'blocked.html'),
        updatePassword: resolve(__dirname, 'update-password.html'),
        student: resolve(__dirname, 'student/index.html'),
        tutor: resolve(__dirname, 'tutor/index.html'),
        admin: resolve(__dirname, 'admin/index.html')
      }
    }
  }
});