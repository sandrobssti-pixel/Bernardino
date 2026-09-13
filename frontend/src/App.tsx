import { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { InboxPage } from './pages/InboxPage';
import { WhatsAppPage } from './pages/WhatsAppPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Sidebar } from './components/Sidebar';

function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-ink-900">
      <Sidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route
          path="/"
          element={
            <AppLayout>
              <InboxPage />
            </AppLayout>
          }
        />
        <Route
          path="/whatsapp"
          element={
            <AppLayout>
              <WhatsAppPage />
            </AppLayout>
          }
        />
        <Route
          path="/settings"
          element={
            <AppLayout>
              <SettingsPage />
            </AppLayout>
          }
        />
      </Route>
    </Routes>
  );
}
