'use client';
import { useState, useEffect } from 'react';
import { Form, Button, Alert, Card, Row, Col } from 'react-bootstrap';
import { updateWeeklyEmailConfig, sendTestEmailHebdomadaire, getCronStatus } from '../../services/api';
import { Toast } from '../../utils/swal';
import { FaEnvelope, FaLock, FaClock, FaPaperPlane, FaSave, FaCog, FaCalendarWeek, FaEye, FaEyeSlash } from 'react-icons/fa';
import PageHeader from '../../components/PageHeader/PageHeader';
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
    email_pass: '', // Jamais renvoyé par le serveur : vide = mot de passe inchangé
    hasPassword: false,
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
      getCronStatus()
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
      
      const saved = await updateWeeklyEmailConfig(configData);

      // Le serveur renvoie la config sans mot de passe (hasPassword à la place)
      setForm(prev => ({ ...prev, ...saved, email_pass: '' }));
      onConfigUpdate?.(saved);

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
    if (!form.email_exp || !form.email_dest || (!form.email_pass && !form.hasPassword) || !form.heure_envoi) {
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
      <div className="ecfg-card">
        <PageHeader
          className="ecfg-header ecfg-header--weekly"
          icon={<FaCalendarWeek />}
          title="Configuration Robot d'envoi Hebdomadaire"
          subtitle="Gérez vos paramètres d'envoi automatique hebdomadaire"
          actions={
            <>
              <div className="ecfg-time-display">
                <FaClock className="me-2" aria-hidden="true" />
                <span className="fw-semibold">{form.heure_envoi}</span>
              </div>
              <span className={`ecfg-status-badge ${form.cron_actif_hebdo ? 'ecfg-status-active' : 'ecfg-status-inactive'}`}>
                {form.cron_actif_hebdo ? '● Active' : '○ Inactive'}
              </span>
            </>
          }
        />
        
        <Card.Body className="p-2">
          {message.text && (
            <Alert variant={message.type} className="ecfg-alert mb-4">
              <FaEnvelope className="me-2" />
              {message.text}
            </Alert>
          )}
          
          <Form onSubmit={handleSubmit}>
            <Row className="g-4">
              {/* Colonne gauche - Destinataires + Identifiants */}
              <Col lg={5}>
                <div className="ecfg-section">
                  <div className="ecfg-section-title d-flex align-items-center gap-2">
                    <FaEnvelope className="ecfg-icon-pulse" /> Destinataires
                  </div>
                  <Form.Group className="mb-3">
                    <Form.Label className="ecfg-label">
                      <FaEnvelope /> Adresse(s) email
                    </Form.Label>
                    <Form.Control as="textarea" rows={3} name="email_dest" value={form.email_dest} onChange={handleChange} className="ecfg-input" placeholder="email1@exemple.com, email2@exemple.com" required />
                  </Form.Group>
                </div>
                
                <div className="ecfg-section">
                  <div className="ecfg-section-title d-flex align-items-center gap-2">
                    <FaLock className="ecfg-icon-pulse" /> Identifiants IONOS
                  </div>
                  <Form.Group className="mb-3">
                    <Form.Label className="ecfg-label">
                      <FaEnvelope /> Adresse email
                    </Form.Label>
                    <Form.Control type="email" name="email_exp" value={form.email_exp} onChange={handleChange} className="ecfg-input" placeholder="votre@email.com" required />
                  </Form.Group>
                  <Form.Group className="mb-0">
                    <Form.Label className="ecfg-label">
                      <FaLock /> Mot de passe
                    </Form.Label>
                    <div className="position-relative">
                      <Form.Control type={showPassword ? 'text' : 'password'} name="email_pass" value={form.email_pass} onChange={handleChange} className="ecfg-input pe-5" placeholder={form.hasPassword ? '•••••• (inchangé)' : '••••••••••••'} autoComplete="new-password" required={!form.hasPassword} />
                      <button type="button" className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-muted ecfg-pass-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                        {showPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                      </button>
                    </div>
                  </Form.Group>
                </div>
              </Col>
              
              {/* Colonne droite - Planification + Toggle */}
              <Col lg={7}>
                <div className="ecfg-section h-100">
                  <div className="ecfg-section-title d-flex align-items-center gap-2">
                    <FaCalendarWeek className="ecfg-icon-pulse" /> Planification Hebdomadaire
                  </div>
                  
                  {/* Sélecteur du jour de la semaine */}
                  <Row className="mb-3">
                    <Col sm={6}>
                      <Form.Label className="ecfg-label">
                        <FaCalendarWeek /> Jour d'envoi
                      </Form.Label>
                      <Form.Select 
                        name="jour_envoi" 
                        value={form.jour_envoi} 
                        onChange={handleJourChange} 
                        className="ecfg-input"
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
                      <Form.Label className="ecfg-label">
                        <FaClock /> Heure d'envoi
                      </Form.Label>
                      <Form.Control type="time" name="heure_envoi" value={form.heure_envoi} onChange={handleChange} className="ecfg-input" required />
                    </Col>
                  </Row>
                  
                  <Form.Group className="mb-3">
                    <Form.Label className="ecfg-label">
                      <FaPaperPlane /> Objet du mail hebdomadaire
                    </Form.Label>
                    <Form.Control 
                      type="text" 
                      name="objet_mail_hebdo" 
                      value={form.objet_mail_hebdo} 
                      onChange={handleChange} 
                      className="ecfg-input" 
                      placeholder="Rapport Hebdomadaire des Stocks"
                      required 
                    />
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label className="ecfg-label">
                      <FaEnvelope /> Message du mail
                    </Form.Label>
                    <Form.Control 
                      as="textarea" 
                      rows={4} 
                      name="message_mail_hebdo" 
                      value={form.message_mail_hebdo} 
                      onChange={handleChange} 
                      className="ecfg-input" 
                      placeholder="Bonjour, veuillez trouver ci-joint le rapport hebdomadaire des stocks." 
                    />
                  </Form.Group>
                  
                  <div className="ecfg-info-box mb-4">
                    <FaCalendarWeek className="me-2 text-primary" />
                    <small className="text-muted">
                      Le rapport sera envoyé <strong>une fois par semaine</strong> le <strong>{getJourLabel()}</strong> à l'heure indiquée
                    </small>
                  </div>
                  
                  <div className="ecfg-toggle-container">
                    <FaCog className="text-muted fs-5" />
                    <span className="fw-bold text-dark">Robot Hebdomadaire</span>
                    <div 
                      className={`ecfg-toggle ${form.cron_actif_hebdo ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, cron_actif_hebdo: !form.cron_actif_hebdo })}
                      role="switch"
                      aria-checked={form.cron_actif_hebdo}
                      aria-label="Activer le robot"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}
                    />
                    <span className={`fw-bold ${form.cron_actif_hebdo ? 'text-success' : 'text-muted'}`}>
                      {form.cron_actif_hebdo ? '● Active' : '○ Inactive'}
                    </span>
                  </div>
                  
                  <Row className="mt-4 g-3">
                    <Col sm={6}>
                      <Button variant="outline-secondary" onClick={handleSendTest} disabled={testLoading || loading} className="w-100 ecfg-btn-outline" >
                        {testLoading ? (
                          <span className="ecfg-loading-spinner"></span>
                        ) : (
                          <>
                            <FaPaperPlane className="me-2" />
                            Envoyer un test
                          </>
                        )}
                      </Button>
                    </Col>
                    <Col sm={6}>
                      <Button variant="primary" type="submit" disabled={loading || testLoading} className="w-100 ecfg-btn-primary" >
                        {loading ? (
                          <span className="ecfg-loading-spinner"></span>
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
