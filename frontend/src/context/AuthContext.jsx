import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);
const readStoredUser = () => {
  try {
    const storedUser = authService.getCurrentUser();
    return storedUser && storedUser.role ? storedUser : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(false);

  const login = async (email, password, role) => {
    setLoading(true);
    try {
      const response = await authService.login(email, password, role);
      if (response.success) {
        const authData = {
          id: response.data.id || response.data._id,
          name: response.data.name,
          email: response.data.email,
          role: response.data.role,
          department: response.data.department,
        };
        localStorage.setItem('user', JSON.stringify(authData));
        setUser(authData);
        return { success: true, user: authData };
      }
      return { success: false, message: response.message || 'Login failed' };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  useEffect(() => {
    const syncUser = () => {
      setUser(readStoredUser());
    };

    syncUser();
    window.addEventListener('storage', syncUser);

    return () => {
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user: user || readStoredUser(), login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
