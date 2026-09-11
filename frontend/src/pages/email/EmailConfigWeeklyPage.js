'use client';
import { useState, useEffect } from 'react';
import { Form, Button, Alert, Card, Row, Col } from 'react-bootstrap';
import { updateWeeklyEmailConfig, sendTestEmailHebdomadaire } from '../../services/api';
import { API_BASE_URL } from '../../config/api';
import Swal from 'sweetalert2';
import { FaEnvelope, FaLock, FaClock, FaPaperPlane, FaSave, FaCog, FaCalendarWeek, FaEye, FaEyeSlash } from 'react-icons/fa';
import './EmailConfigPage.css';

export default function EmailConfigWeeklyPage({ initialConfig, onConfigUpdate }) {
  // Définition des états
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [, setIsRunning] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Fonction pour obtenir la date du jour au format français
  const getCurrentWeek = () => {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return today.toLocaleDateString('fr-FR', options);
  };

  // Jours de la semaine en français
  const joursSemaine = [
    { value: 0, label: 'Dimanche' },
    { value: 1, label: 'Lundi' },
    { value: 2, label: 'Mardi' },
    { value: 3, label: 'Mercredi' },
    { value: 4, label: 'Jeudi' },
    { value: 5, label: 'Vendredi' },
    { value: 6, label: 'Samedi' }
  ];

  // Initialisation avec tous les champs pour l'envoi hebdomadaire
  const [form, setForm] = useState({
    email_dest: '',
    email_exp: '',
    email_pass: '',
    type_envoi: 'hebdomadaire',
    objet_mail_hebdo: `Rapport Hebdomadaire des Stocks - ${getCurrentWeek()}`,
    message_mail_hebdo: `Bonjour, veuillez trouver ci-joint le rapport hebdomadaire des stocks du ${getCurrentWeek()}.`,
    jour_envoi: 1, // Lundi par défaut
    heure_envoi: '17:15',
    cron_actif_hebdo: false
  });

  useEffect(() => {
    if (initialConfig) {
      setForm(prev => ({
        ...prev,
        ...initialConfig,
        type_envoi: 'hebdomadaire',
        cron_actif_hebdo: initialConfig.cron_actif_hebdo || false
      }));
    }
  }, [initialConfig]);

  useEffect(() => {
      fetch(`${API_BASE_URL}/api/cron/status`)
          .then(res => res.json())
          .then(data => setIsRunning(data.runningWeekly || false))
          .catch(err => console.warn("Le serveur Robot n'est pas encore démarré."));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prevForm => ({ ...prevForm, [name]: value }));
  };

  const handleJourChange = (e) => {
    setForm(prevForm => ({ ...prevForm, jour_envoi: parseInt(e.target.value) }));
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
      // Envoyer la configuration hebdomadaire avec les nouveaux endpoints
      const configData = {
        ...form,
        type_envoi: 'hebdomadaire',
        jour_envoi: parseInt(form.jour_envoi),
        cron_actif_hebdo: form.cron_actif_hebdo
      };
      
      await updateWeeklyEmailConfig(configData);

      onConfigUpdate?.(configData);

      Toast.fire({
        icon: 'success',
        title: 'Configuration hebdomadaire sauvegardée',
        text: `Robot actif le ${joursSemaine.find(j => j.value === parseInt(form.jour_envoi))?.label} à ${form.heure_envoi}`
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
      const data = await sendTestEmailHebdomadaire();
      setMessage({ type: 'info', text: data.message || 'Mail de test envoyé avec succès !' });
    } catch (error) {
      setMessage({ type: 'danger', text: `Échec : ${error.message}. Vérifiez vos identifiants IONOS.` });
    } finally {
      setTestLoading(false);
    }
  };

  // Obtenir le nom du jour sélectionné
  const getJourLabel = () => {
    const jour = joursSemaine.find(j => j.value === parseInt(form.jour_envoi));
    return jour ? jour.label : 'Lundi';
  };

  return (
    <>
      <div className="modern-card">
        <div className="modern-header d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <div className="header-icon" style={{ background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)' }}>
              <FaCalendarWeek className="fs-4 text-white" />
            </div>
            <div>
              <h2 className="h5 mb-0 text-white fw-bold">
                Configuration Robot d'envoi Hebdomadaire
              </h2>
              <small className="text-white-50">Gérez vos paramètres d'envoi automatique hebdomadaire</small>
            </div>
          </div>
          <div className="d-flex align-items-center gap-3">
            <div className="time-display text-white">
              <FaClock className="me-2" />
              <span className="fw-semibold">{form.heure_envoi}</span>
            </div>
            <span className={`status-badge ${form.cron_actif_hebdo ? 'status-active' : 'status-inactive'}`}>
              {form.cron_actif_hebdo ? '● Active' : '○ Inactive'}
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
                    <FaCalendarWeek className="icon-pulse" /> Planification Hebdomadaire
                  </div>
                  
                  {/* Sélecteur du jour de la semaine */}
                  <Row className="mb-3">
                    <Col sm={6}>
                      <Form.Label className="modern-label">
                        <FaCalendarWeek /> Jour d'envoi
                      </Form.Label>
                      <Form.Select 
                        name="jour_envoi" 
                        value={form.jour_envoi} 
                        onChange={handleJourChange} 
                        className="modern-input"
                        required
                      >
                        {joursSemaine.map(jour => (
                          <option key={jour.value} value={jour.value}>
                            {jour.label}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col sm={6}>
                      <Form.Label className="modern-label">
                        <FaClock /> Heure d'envoi
                      </Form.Label>
                      <Form.Control type="time" name="heure_envoi" value={form.heure_envoi} onChange={handleChange} className="modern-input" required />
                    </Col>
                  </Row>
                  
                  <Form.Group className="mb-3">
                    <Form.Label className="modern-label">
                      <FaPaperPlane /> Objet du mail hebdomadaire
                    </Form.Label>
                    <Form.Control 
                      type="text" 
                      name="objet_mail_hebdo" 
                      value={form.objet_mail_hebdo} 
                      onChange={handleChange} 
                      className="modern-input" 
                      placeholder="Rapport Hebdomadaire des Stocks"
                      required 
                    />
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label className="modern-label">
                      <FaEnvelope /> Message du mail
                    </Form.Label>
                    <Form.Control 
                      as="textarea" 
                      rows={4} 
                      name="message_mail_hebdo" 
                      value={form.message_mail_hebdo} 
                      onChange={handleChange} 
                      className="modern-input" 
                      placeholder="Bonjour, veuillez trouver ci-joint le rapport hebdomadaire des stocks." 
                    />
                  </Form.Group>
                  
                  <div className="info-box mb-4">
                    <FaCalendarWeek className="me-2 text-primary" />
                    <small className="text-muted">
                      Le rapport sera envoyé <strong>une fois par semaine</strong> le <strong>{getJourLabel()}</strong> à l'heure indiquée
                    </small>
                  </div>
                  
                  <div className="modern-toggle-container">
                    <FaCog className="text-muted fs-5" />
                    <span className="fw-bold text-dark">Robot Hebdomadaire</span>
                    <div 
                      className={`modern-toggle ${form.cron_actif_hebdo ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, cron_actif_hebdo: !form.cron_actif_hebdo })}
                      role="switch"
                      aria-checked={form.cron_actif_hebdo}
                    />
                    <span className={`fw-bold ${form.cron_actif_hebdo ? 'text-success' : 'text-muted'}`}>
                      {form.cron_actif_hebdo ? '● Active' : '○ Inactive'}
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
