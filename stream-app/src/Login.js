import { useState } from 'react';
import { Form, Button, Card } from 'react-bootstrap';

import './Login.css';

const { Label, Control } = Form;

function Login({ setPassword }) {
  const [ curPassword, setCurPassword ] = useState(''); // TODO: Remove!

  return <div className='login-card mt-5'>
    <Card style={{ width: '18rem' }}>
      <Card.Body>
        <Card.Title>Login</Card.Title>
        <Card.Text>
          <Label>Password</Label>
          <Control value={curPassword} onChange={e => setCurPassword(e.target.value)}
            placeholder="Password" type="password"/>
        </Card.Text>
        <Button onClick={e => setPassword(curPassword)}>Login</Button>
      </Card.Body>
    </Card>
  </div>;
}

export default Login;
