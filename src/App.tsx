import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { Dashboard } from './components/dashboard/Dashboard';

type AuthView = 'login' | 'register';

function App() {
  const { user, userProfile, loading } = useAuth();
  const [authView, setAuthView] = useState<AuthView>('login');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    if (authView === 'register') {
      return <RegisterPage onShowLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onShowRegister={() => setAuthView('register')} />;
  }

  return <Dashboard />;
}

export default App;