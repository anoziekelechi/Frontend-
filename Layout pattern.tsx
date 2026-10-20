import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

function ModernRegistrationForm() {
  return (
    <Form style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h2 className="mb-4 text-center">Create Your Account</h2>

      {/* Modern Pattern: Grouping short, highly-related inputs inline */}
      <Row>
        <Col md={6}>
          <Form.Group className="mb-3" controlId="regFirstName">
            <Form.Label className="fw-semibold">First Name</Form.Label>
            <Form.Control type="text" placeholder="Jane" required />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group className="mb-3" controlId="regLastName">
            <Form.Label className="fw-semibold">Last Name</Form.Label>
            <Form.Control type="text" placeholder="Doe" required />
          </Form.Group>
        </Col>
      </Row>

      {/* Standard Vertical Form Group */}
      <Form.Group className="mb-3" controlId="regEmail">
        <Form.Label className="fw-semibold">Email address</Form.Label>
        <Form.Control type="email" placeholder="name@example.com" required />
        <Form.Text className="text-muted">
          We will never share your email.
        </Form.Text>
      </Form.Group>

      {/* Full-width call to action button */}
      <Button variant="primary" type="submit" className="w-100 py-2 mt-2 fw-bold">
        Sign Up
      </Button>
    </Form>
  );
}

export default ModernRegistrationForm;
