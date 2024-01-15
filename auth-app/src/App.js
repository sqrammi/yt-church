import './App.css';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

import { clientId, clientSecret } from './creds.json';

const scopes = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.force-ssl',
];

function MyLogin() {
  const login = useGoogleLogin({
    onSuccess: async tokenResponse => {
      const { code } = tokenResponse;
      console.log('code', code);
    },
    flow: 'auth-code',
    scope: scopes.join(' '),
  });

  return (
      <button onClick={() => login()}>Sign in with Google 🚀</button>
  );
}

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <GoogleOAuthProvider clientId={clientId}>
          <MyLogin/>
        </GoogleOAuthProvider>
      </header>
    </div>
  );
}

export default App;
