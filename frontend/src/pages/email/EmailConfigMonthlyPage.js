'use client';
import { useState, useEffect } from 'react';
import { Form, Button, Alert, Card, Row, Col } from 'react-bootstrap';
import { updateMonthlyEmailConfig, sendTestEmailMensuel } from '../../services/api';
import { API_BASE_URL } from '../../config/api';
import Swal from 'sweetalert2';
import { FaEnvelope, FaLock, FaClock, FaPaperPlane, FaSave, FaCog, FaCalendarAlt, FaEye, FaEyeSlash } from 'react-icons/fa';
import './EmailConfigPage.css';

export default function EmailConfigMonthlyPage({ initialConfig, onConfigUpdate }) {
  // Définition des états
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Fonction pour obtenir la date du jour au format français
  const getCurrentDate = () => {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return today.toLocaleDateString('fr-FR', options);
  };

  // Fonction pour obtenir le mois actuel
  const getCurrentMonth = () => {
    const today = new Date();
    const options = { year: 'numeric', month: 'long' };
    return today.toLocaleDateString('fr-FR', options);
  };

  // Initialisation avec tous les champs du nouveau schéma
  const [form, setForm] = useState({
    email_dest: '',
    email_exp: '',
    email_pass: '',
    objet_mail: `Rapport Mensuel des Stocks - ${getCurrentMonth()}`,
    message_mail: `Bonjour, veuillez trouver ci-joint le rapport mensuel des stocks du ${getCurrentMonth()}.`,
    heure_envoi: '17:15',
    jour_envoi: '1', // Jour du mois pour l'envoi (1-28)
    cron_actif: false
  });

  useEffect(() => {
    if (initialConfig) {
      setForm(prev => ({ ...prev, ...initialConfig }));
    }
  }, [initialConfig]);

  useEffect(() => {
      fetch(`${API_BASE_URL}/api/cron/status`)
          .then(res => res.json())
          .then(data => setIsRunning(data.running))
          .catch(err => console.warn("Le serveur Robot n'est pas encore démarré."));
  }, []);

  const toggleCron = async () => {
    try {
        const action = isRunning ? 'stop' : 'start';
        const response = await fetch(`${API_BASE_URL}/api/cron/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, type: 'mensuel' })
        });

        if (!response.ok) throw new Error('Erreur serveur');

        const data = await response.json();
        setIsRunning(data.running);
    } catch (error) {
        console.error("Erreur de connexion au Robot :", error);
        alert("Impossible de contacter le serveur Robot. Vérifiez qu'il est lancé sur le port 3001.");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prevForm => ({ ...prevForm, [name]: value }));
  };

  const Toast = Swal.mixin({
    toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateMonthlyEmailConfig(form);

      onConfigUpdate?.(form);

      Toast.fire({
        icon: 'success',
        title: 'Configuration mensuelle sauvegardée',
        text: `Robot ${form.cron_actif ? 'actif' : 'inactif'} (Jour ${form.jour_envoi} à ${form.heure_envoi})`
      });

    } catch (err) {
      Toast.fire({
        icon: 'error', title: 'Erreur', text: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    if (!form.email_exp || !form.email_dest || !form.email_pass || !form.heure_envoi) {
      setMessage({ type: 'warning', text: 'Veuillez remplir tous les champs avant de tester.' });
      return;
    }

    setTestLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const data = await sendTestEmailMensuel();
      setMessage({ type: 'info', text: data.message || 'Mail de test mensuel envoyé avec succès !' });
    } catch (error) {
      setMessage({ type: 'danger', text: `Échec : ${error.message}. Vérifiez vos identifiants IONOS.` });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <>
      <div className="modern-card">
        <div className="modern-header d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <div className="header-icon">
              <FaCalendarAlt className="fs-4 text-white" />
            </div>
            <div>
              <h2 className="h5 mb-0 text-white fw-bold">
                Configuration Robot d'envoi Mensuel
              </h2>
              <small className="text-white-50">Gérez vos paramètres d'envoi automatique mensuel</small>
            </div>
          </div>
          <div className="d-flex align-items-center gap-3">
            <div className="time-display text-white">
              <FaClock className="me-2" />
              <span className="fw-semibold">Jour {form.jour_envoi} - {form.heure_envoi}</span>
            </div>
            <span className={`status-badge ${form.cron_actif ? 'status-active' : 'status-inactive'}`}>
              {form.cron_actif ? '● Active' : '○ Inactive'}
            </span>
          </div>
        </div>
        
        <Card.Body className="p-2">
          {message.text && (
            <Alert variant={message.type} className="alert-custom mb-4">
              <FaEnvelope className="me-2" />
              {message.text}
            </Alert>
          )}
          
          <Form onSubmit={handleSubmit}>
            <Row className="g-4">
              {/* Colonne gauche - Destinataires + Identifiants */}
              <Col lg={5}>
                <div className="form-section">
                  <div className="form-section-title d-flex align-items-center gap-2">
                    <FaEnvelope className="icon-pulse" /> Destinataires
                  </div>
                  <Form.Group className="mb-3">
                    <Form.Label className="modern-label">
                      <FaEnvelope /> Adresse(s) email
                    </Form.Label>
                    <Form.Control as="textarea" rows={3} name="email_dest" value={form.email_dest} onChange={handleChange} className="modern-input" placeholder="email1@exemple.com, email2@exemple.com" required />
                  </Form.Group>
                </div>
                
                <div className="form-section">
                  <div className="form-section-title d-flex align-items-center gap-2">
                    <FaLock className="icon-pulse" /> Identifiants IONOS
                  </div>
                  <Form.Group className="mb-3">
                    <Form.Label className="modern-label">
                      <FaEnvelope /> Adresse email
                    </Form.Label>
                    <Form.Control type="email" name="email_exp" value={form.email_exp} onChange={handleChange} className="modern-input" placeholder="votre@email.com" required />
                  </Form.Group>
                  <Form.Group className="mb-0">
                    <Form.Label className="modern-label">
                      <FaLock /> Mot de passe
                    </Form.Label>
                    <div className="position-relative">
                      <Form.Control type={showPassword ? 'text' : 'password'} name="email_pass" value={form.email_pass} onChange={handleChange} className="modern-input pe-5" placeholder="••••••••••••" required />
                      <button type="button" className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-muted" style={{ background: 'none', border: 'none', padding: '0.5rem' }} onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </Form.Group>
                </div>
              </Col>
              
              {/* Colonne droite - Planification + Toggle */}
              <Col lg={7}>
                <div className="form-section h-100">
                  <div className="form-section-title d-flex align-items-center gap-2">
                    <FaClock className="icon-pulse" /> Planification Mensuelle
                  </div>
                  <Row className="mb-3">
                    <Col sm={5}>
                      <Form.Label className="modern-label">
                        <FaCalendarAlt /> Jour du mois
                      </Form.Label>
                     <Form.Control type="number" name="jour_envoi" value={form.jour_envoi} onChange={handleChange} className="modern-input" min="1" max="28" required />
                      <small className="text-muted">(1-28, le 29-31 non supporté)</small>
                    </Col>
                    <Col sm={7}>
                      <Form.Label className="modern-label">
                        <FaClock /> Heure d'envoi
                      </Form.Label>
                      <Form.Control type="time" name="heure_envoi" value={form.heure_envoi} onChange={handleChange} className="modern-input" required />
                    </Col>
                  </Row>
                  
                  <Form.Group className="mb-3">
                    <Form.Label className="modern-label">
                      <FaPaperPlane /> Objet du mail
                    </Form.Label>
                    <Form.Control type="text" name="objet_mail" value={form.objet_mail} onChange={handleChange} className="modern-input" required />
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label className="modern-label">
                      <FaEnvelope /> Message du mail
                    </Form.Label>
                    <Form.Control as="textarea" rows={3} name="message_mail" value={form.message_mail} onChange={handleChange} className="modern-input" placeholder="Bonjour, veuillez trouver ci-joint le rapport mensuel des stocks." />
                  </Form.Group>
                  
                  <div className="info-box mb-4">
                    <FaCalendarAlt className="me-2 text-primary" />
                    <small className="text-muted">
                      Le rapport sera envoyé chaque mois le jour {form.jour_envoi} à {form.heure_envoi}
                    </small>
                  </div>
                  
                  <div className="modern-toggle-container">
                    <FaCog className="text-muted fs-5" />
                    <span className="fw-bold text-dark">Robot</span>
                    <div 
                      className={`modern-toggle ${form.cron_actif ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, cron_actif: !form.cron_actif })}
                      role="switch"
                      aria-checked={form.cron_actif}
                    />
                    <span className={`fw-bold ${form.cron_actif ? 'text-success' : 'text-muted'}`}>
                      {form.cron_actif ? '● Active' : '○ Inactive'}
                    </span>
                  </div>
                  
                  <Row className="mt-4 g-3">
                    <Col sm={6}>
                      <Button variant="outline-secondary" onClick={handleSendTest} disabled={testLoading || loading} className="w-100 modern-btn-outline" >
                        {testLoading ? (
                          <span className="loading-spinner"></span>
                        ) : (
                          <>
                            <FaPaperPlane className="me-2" />
                            Envoyer un test
                          </>
                        )}
                      </Button>
                    </Col>
                    <Col sm={6}>
                      <Button variant="primary" type="submit" disabled={loading || testLoading} className="w-100 modern-btn-primary" >
                        {loading ? (
                          <span className="loading-spinner"></span>
                        ) : (
                          <>
                            <FaSave className="me-2" />
                            Sauvegarder
                          </>
                        )}
                      </Button>
                    </Col>
                  </Row>
                </div>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </div>
    </>
  );
}