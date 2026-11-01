import { useState } from 'react';
import './App.css';

import Login from './Login';
import Dashboard from './Dashboard';

function App({ config }) {
  const [ password, setPassword ] = useState('');

  const common = { password, setPassword };

  if (!password)
    return <Login {...common}/>
  else return <Dashboard {...common} config={config}/>
}

export default App;
