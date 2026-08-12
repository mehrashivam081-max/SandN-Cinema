const readStoredValue = (key) => localStorage.getItem(key) || sessionStorage.getItem(key) || '';

// ✅ SUPER TOKEN GRABBER: 'authToken' aur 'token' dono ko check karega, kabhi Khali (null) nahi bhejega!
export const getValidToken = () => readStoredValue('authToken') || readStoredValue('token');
