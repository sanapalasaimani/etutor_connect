import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    port: 3000,
    strictPort: true,
  },
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
        admin: resolve(__dirname, 'admin/index.html'),
        adminReview: resolve(__dirname, 'admin/tutor-review.html'),
        tutorApprovals: resolve(__dirname, 'admin/tutor-approvals.html'),
        learning: resolve(__dirname, 'student/learning.html')
      }
    }
  }
});