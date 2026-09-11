import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Container, Navbar, Nav, NavDropdown, Modal, Button, Alert, Form, Badge } from 'react-bootstrap';
import { FaHome, FaLaptopCode, FaEnvelopeOpenText, FaBoxes, FaUserCircle, FaSignOutAlt, FaProductHunt, FaExchangeAlt, FaArrowCircleRight, FaArrowRight, FaMapMarkerAlt, FaBars, FaTimes, FaTicketAlt, FaEye, FaEyeSlash, FaCheck, FaList, FaHistory, FaUsers, FaFileAlt, FaMobileAlt } from 'react-icons/fa';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import logo from '../../assets/logo.png';
import { API_ENDPOINTS, PAGE_TITLES, ROLES, validatePassword, hasPermission, PERMISSIONS } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/api';
import './Navbar.css';

const MySwal = withReactContent(Swal);

const FixedNavbarWithLogo = () => {
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const handleCloseProfile = () => {
    setShowProfile(false);
    setNewPasswords({ p1: '', confirm: '' });
    setUpdateStatus({ type: '', msg: '' });
    setShowP1(false);
  };
  const handleShowProfile = () => {
    setNewPasswords({ p1: '', confirm: '' });
    setUpdateStatus({ type: '', msg: '' });
    setShowProfile(true);
  };
  const [newPasswords, setNewPasswords] = useState({ p1: '', confirm: '' });
  const [updateStatus, setUpdateStatus] = useState({ type: '', msg: '' });
  const [showP1, setShowP1] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const getPageTitle = () => {
    return PAGE_TITLES[location.pathname] || 'Accueil';
  };

  const getRoleDisplay = (role) => {
    return ROLES[role] || { label: role || 'Utilisateur', className: 'role-default' };
  };


  const [isMouvementsDropdownOpen, setIsMouvementsDropdownOpen] = useState(false);
  const [isMaterielsDropdownOpen, setIsMaterielsDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const userEmails = Array.isArray(user?.emails) && user.emails.length
    ? user.emails
    : [user?.email_1, user?.email_2]
        .filter(Boolean)
        .map((email, idx) => ({ email, is_primary: idx === 0 }));
  const userRole = user?.role || '';
  const materielData = user?.materiel || user?.details_materiel;
  const materielUser = materielData?.utilisateur || '';
  const materielIdN = materielData?.id_n || '';

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const avatarSrc = user?.avatar || user?.photo || user?.profile_picture || user?.image || null;

  const roleDisplay = getRoleDisplay(userRole);

  const handleInputChange = (e) => {
    setNewPasswords({ ...newPasswords, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.user-nav-info') && !event.target.closest('.nav-dropdown-wrapper') && !event.target.closest('.documents-nav-link')) {
        setIsUserDropdownOpen(false);
        setIsMouvementsDropdownOpen(false);
        setIsMaterielsDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fonction de déconnexion avec confirmation Sweetalert
  const handleLogout = async () => {
    MySwal.fire({
      title: 'Confirmer la déconnexion',
      text: 'Êtes-vous sûr de vouloir vous déconnecter ?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Oui, déconnecter',
      cancelButtonText: 'Annuler',
      backdrop: true,
      allowOutsideClick: false
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await logout();
        } catch (error) {
          console.error("Erreur lors de l'appel API logout:", error);
        } finally {
          MySwal.fire({
            icon: 'success',
            title: 'Déconnexion réussie',
            text: 'À bientôt !',
            timer: 2000,
            showConfirmButton: false
          }).then(() => {
            navigate('/login');
          });
        }
      }
    });
  };

  const isActive = (path) => location.pathname.startsWith(path);

  const handleUpdatePassword = async () => {
    if (!newPasswords.p1) {
      setUpdateStatus({ type: 'warning', msg: 'Veuillez saisir un nouveau mot de passe UserMail.' });
      return;
    }

    if (newPasswords.p1 !== newPasswords.confirm) {
      setUpdateStatus({ type: 'warning', msg: 'Les mots de passe ne correspondent pas.' });
      return;
    }

    // Validation du mot de passe UserMail
    const errorP1 = validatePassword(newPasswords.p1);
    if (errorP1) {
      setUpdateStatus({ type: 'warning', msg: errorP1 });
      return;
    }

    setIsUpdating(true);
    try {
      const response = await apiClient.post('/auth/update-passwords', {
        p1: newPasswords.p1
      });

      const data = response?.data;
      if (data && data.success !== false && !data.error) {
        setUpdateStatus({ type: 'success', msg: 'Mot de passe UserMail mis à jour avec succès ! Vous allez être déconnecté.' });
        setNewPasswords({ p1: '', confirm: '' });

        setTimeout(async () => {
          handleCloseProfile();
          try {
            await logout();
          } catch (err) {
            console.error("Erreur lors de la déconnexion après mise à jour du mot de passe:", err);
          } finally {
            navigate('/login');
          }
        }, 2000);
      } else {
        setUpdateStatus({ type: 'danger', msg: data?.error || 'Une erreur est survenue lors de la mise à jour.' });
      }
    } catch (err) {
      console.error("Erreur lors de la mise à jour du mot de passe:", err);
      setUpdateStatus({ type: 'danger', msg: `Erreur serveur : ${err.message || 'Impossible de contacter le serveur.'}` });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <Navbar expand="lg" expanded={expanded} onToggle={setExpanded} fixed="top" className={`custom-navbar ${scrolled ? 'navbar-scrolled' : ''}`} >
        <Container>
          <Navbar.Brand as={Link} to="/Home" className="brand-container">
            <div className="logo-wrapper">
              <img src={logo} alt="Logo" className="navbar-logo" />
            </div>
            <div className="brand-text-wrapper">
              <span className="brand-text">InvTech <span className="text-accent">IT</span></span>
              <span className="page-title">{getPageTitle()}</span>
            </div>
          </Navbar.Brand>

          <Navbar.Toggle aria-controls="basic-navbar-nav">
            {expanded ? <FaTimes /> : <FaBars />}
          </Navbar.Toggle>

          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ms-auto align-items-center nav-items-wrapper">
              <Nav.Link as={Link} to="/Home" className={location.pathname === '/Home' ? 'nav-active' : ''}>
                <div className="nav-item-wrapper">
                  <div className="nav-item-icon">
                    <FaHome />
                  </div>
                  <span className="nav-item-label">Accueil</span>
                </div>
              </Nav.Link>

              {/* Menu Matériels */}
              {hasPermission(userRole, PERMISSIONS.MATERIELS_READ) && (
                <div className="nav-dropdown-wrapper" onMouseEnter={() => setIsMaterielsDropdownOpen(true)} onMouseLeave={() => setIsMaterielsDropdownOpen(false)}>
                  <NavDropdown
                    title={
                      <div className="dropdown-title-wrapper">
                        <div className="nav-item-icon">
                          <FaLaptopCode />
                        </div>
                        <span className="nav-item-label">
                          Matériels
                          <span className="dropdown-arrow">▼</span>
                        </span>
                      </div>
                    }
                    id="materiels-nav-dropdown"
                    className={isActive('/Materiels') ? 'nav-active' : ''}
                    show={isMaterielsDropdownOpen}
                    onToggle={() => setIsMaterielsDropdownOpen(!isMaterielsDropdownOpen)}
                  >
                    {userRole === 'USER' ? (
                      <>
                        <div className="dropdown-header-section">
                          <FaList className="dropdown-header-icon" />
                          <span>Matériels</span>
                        </div>
                        <NavDropdown.Item as={Link} to="/Materiels" className="dropdown-menu-item">
                          <span className="menu-item-text">Mon matériel </span>
                        </NavDropdown.Item>

                        <NavDropdown.Divider className="dropdown-divider" />

                        <div className="dropdown-header-section">
                          <FaHistory className="dropdown-header-icon" />
                          <span>Historique</span>
                        </div>
                        <NavDropdown.Item as={Link} to="/HistoriqueMateriel" className="dropdown-menu-item">
                          <span className="menu-item-text">Mon historique</span>
                        </NavDropdown.Item>
                      </>
                    ) : (
                      <>
                        <div className="dropdown-header-section">
                          <FaList className="dropdown-header-icon" />
                          <span>Matériels</span>
                        </div>
                        <NavDropdown.Item as={Link} to="/Materiels" className="dropdown-menu-item">
                          <span className="menu-item-text">Liste des matériels</span>
                        </NavDropdown.Item>

                        <NavDropdown.Divider className="dropdown-divider" />

                        <div className="dropdown-header-section">
                          <FaHistory className="dropdown-header-icon" />
                          <span>Historique</span>
                        </div>
                        <NavDropdown.Item as={Link} to="/HistoriqueMateriel" className="dropdown-menu-item">
                          <span className="menu-item-text">Historique Matériel</span>
                        </NavDropdown.Item>
                      </>
                    )}
                  </NavDropdown>
                </div>
              )}

              {hasPermission(userRole, PERMISSIONS.USERS_READ) && (
                <Nav.Link as={Link} to="/MailInfo" className={isActive('/MailInfo') ? 'nav-active' : ''}>
                  <div className="nav-item-wrapper">
                    <div className="nav-item-icon">
                      <FaEnvelopeOpenText />
                    </div>
                    <span className="nav-item-label">Utilisateurs</span>
                  </div>
                </Nav.Link>
              )}

              {/* Menu Mouvements */}
              {hasPermission(userRole, PERMISSIONS.STOCKS_READ) && (
                <div className="nav-dropdown-wrapper" onMouseEnter={() => setIsMouvementsDropdownOpen(true)} onMouseLeave={() => setIsMouvementsDropdownOpen(false)} >
                  <NavDropdown
                    title={
                      <div className="dropdown-title-wrapper">
                        <div className="nav-item-icon">
                          <FaBoxes />
                        </div>
                        <span className="nav-item-label">
                          Stocks
                         <span className="dropdown-arrow">▼</span>
                        </span>
                      </div>
                    }
                    id="stock-nav-dropdown"
                    className={isActive('/Mouvements') || isActive('/Historique') ? 'nav-active' : ''}
                    show={isMouvementsDropdownOpen}
                    onToggle={() => setIsMouvementsDropdownOpen(!isMouvementsDropdownOpen)}
                  >
                    <div className="dropdown-header-section">
                      <FaExchangeAlt className="dropdown-header-icon" />
                      <span>Gestion des Stocks</span>
                    </div>
                    <NavDropdown.Item as={Link} to="/Mouvements" className="dropdown-menu-item">
                      <span className="menu-item-text">Vue d'ensemble</span>
                    </NavDropdown.Item>
                    
                    <NavDropdown.Divider className="dropdown-divider" />
                    
                    <div className="dropdown-header-section">
                      <FaArrowCircleRight className="dropdown-header-icon" />
                      <span>Historique</span>
                    </div>
                    <NavDropdown.Item as={Link} to="/HistoriqueArrivees" className="dropdown-menu-item">
                      <span className="menu-item-text">Entrées de stock</span>
                    </NavDropdown.Item>
                    
                    <NavDropdown.Divider className="dropdown-divider" />
                    
                    <div className="dropdown-header-section">
                      <FaProductHunt className="dropdown-header-icon" />
                      <span>Ressources</span>
                    </div>
                    <NavDropdown.Item as={Link} to="/ProduitLocaux" className="dropdown-menu-item">
                      <span className="menu-item-text">Produits & Locaux</span>
                    </NavDropdown.Item>
                  </NavDropdown>
                </div>
              )}

              {hasPermission(userRole, PERMISSIONS.TICKETS_READ) && (
                <Nav.Link as={Link} to="/Tickets" className={isActive('/Tickets') ? 'nav-active' : ''}>
                  <div className="nav-item-wrapper">
                    <div className="nav-item-icon">
                      <FaTicketAlt />
                    </div>
                    <span className="nav-item-label">Support</span>
                  </div>
                </Nav.Link>
              )}

              {/* Menu Documents */}
              {hasPermission(userRole, PERMISSIONS.DOCUMENTS_READ) && (
                <Nav.Link as={Link} to="/Documents" className={isActive('/Documents') ? 'nav-active' : ''}>
                  <div className="nav-item-wrapper">
                    <div className="nav-item-icon">
                      <FaFileAlt />
                    </div>
                    <span className="nav-item-label">Documents</span>
                  </div>
                </Nav.Link>
              )}
              
              {hasPermission(userRole, PERMISSIONS.CONFIG_READ) && (
                <Nav.Link as={Link} to="/EmailHome" className={isActive('/EmailHome') ? 'nav-active' : ''}>
                  <div className="nav-item-wrapper">
                    <div className="nav-item-icon">
                      <FaEnvelopeOpenText />
                    </div>
                    <span className="nav-item-label">Emails</span>
                  </div>
                </Nav.Link>
              )}

               

              {/* Menu Utilisateur */}
              {user && (
                <div className="user-nav-info d-flex align-items-center ms-lg-3" onMouseEnter={() => setIsUserDropdownOpen(true)} onMouseLeave={() => setIsUserDropdownOpen(false)} >
                  <NavDropdown
                    title={
                      <div className="user-badge-modern d-flex align-items-center gap-2 px-3 py-2">
                        <div className="user-avatar-wrapper">
                          {avatarSrc ? (
                            <img src={avatarSrc} alt="Avatar" className="user-avatar-img" />
                          ) : (
                            <div className="user-avatar-fallback">
                              {getInitials(materielUser || user?.nom || user?.name || user?.username)}
                            </div>
                          )}
                        </div>
                        <div className="d-flex flex-column">
                          <span className="user-name-text">{materielUser || user?.nom || user?.name || user?.username || 'Utilisateur'}</span>
                        </div>
                      </div>
                    }
                    id="user-nav-dropdown"
                    className="custom-user-dropdown"
                    show={isUserDropdownOpen}
                    onToggle={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  >
                    <div className="user-dropdown-header d-flex align-items-center gap-2">
                      <FaUserCircle className="user-avatar-icon" />
                      <span>Mon compte</span>
                    </div>

                    <div className="user-emails-section">
                      <div className="emails-label">Informations</div>
                      <div className="email-item">
                        <FaUserCircle className="email-icon" />
                        <span className="email-text">{materielUser || user?.nom || user?.name || user?.username || 'Utilisateur'}</span>
                      </div>
                      <div className="email-item">
                        <FaList className="email-icon" />
                        <span className="email-text">{user?.id_n || materielIdN || 'N/A'}</span>
                      </div>
                      <div className="email-item">
                        <FaEnvelopeOpenText className="email-icon" />
                        <span className="email-text">{userEmails.find(e => e.is_primary)?.email || userEmails[0]?.email || 'N/A'}</span>
                      </div>
                      <div className="email-item">
                        <FaUsers className="email-icon" />
                        <span className="email-text"><strong></strong> {materielData?.equipe || 'N/A'}</span>
                      </div>
                    </div>

                    <NavDropdown.Divider className="my-1" />

                    <NavDropdown.Item onClick={handleShowProfile} className="user-menu-item">
                      <div className="menu-item-content">
                        <div className="menu-item-icon profile-icon">
                          <FaUserCircle />
                        </div>
                        <span>Détails et modification</span>
                      </div>
                    </NavDropdown.Item>

                    <NavDropdown.Divider className="my-1" />

                    <NavDropdown.Item onClick={handleLogout} className="user-menu-item logout-item">
                      <div className="menu-item-content">
                        <div className="menu-item-icon logout-icon">
                          <FaSignOutAlt />
                        </div>
                        <span>Déconnexion</span>
                      </div>
                    </NavDropdown.Item>
                  </NavDropdown>
                </div>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {/* Modal de Profil Moderne */}
      <Modal 
        show={showProfile} 
        onHide={handleCloseProfile} 
        centered 
        size="lg"
        className="profile-modal-modern profile-modal-two-col"
      >
        <Modal.Header closeButton className="modal-header-modern">
          <div className="modal-header-content">
            <div className="modal-icon-wrapper">
              <FaUserCircle aria-label="Mon profil" />
            </div>
            <div>
              <Modal.Title className="modal-title-modern">Mon Profil</Modal.Title>
              <p className="modal-subtitle">Gérez vos informations personnelles</p>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body className="modal-body-modern">
          {/* Bannière de profil centrée */}
          <div className="profile-banner-wrapper">
            <div className="profile-banner">
              <div className="profile-avatar-ring">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Avatar" className="profile-avatar-img" />
                ) : (
                  <span className="profile-avatar-fallback">
                    {getInitials(materielUser || user?.nom || user?.name || user?.username)}
                  </span>
                )}
              </div>
              <h4 className="profile-name">{materielUser || user?.nom || user?.name || user?.username || 'Utilisateur'}</h4>
              <span className={`badge-role ${roleDisplay.className}`}>{roleDisplay.label}</span>
            </div>
          </div>

          {/* Layout en 2 colonnes */}
          <div className="profile-two-col">
            {/* Colonne gauche : infos utilisateur */}
            <div className="profile-col profile-col-info">
              <h5 className="section-title">
                <FaUserCircle /> Mes informations
              </h5>
              <div className="profile-info-cards">
                
                <div className="info-card">
                  <div className="info-icon">
                    <FaEnvelopeOpenText />
                  </div>
                  <div className="info-content">
                    <span className="info-label">Email (UserMail)</span>
                    <span className="info-value">{userEmails.find(e => e.is_primary)?.email || userEmails[0]?.email || 'N/A'}</span>
                  </div>
                </div>
                <div className="info-card">
                  <div className="info-icon">
                    <FaList />
                  </div>
                  <div className="info-content">
                    <span className="info-label">Matricule</span>
                    <span className="info-value">{user?.id_n || materielIdN || 'N/A'}</span>
                  </div>
                </div>
                <div className="info-card">
                  <div className="info-icon">
                    <FaUsers />
                  </div>
                  <div className="info-content">
                    <span className="info-label">Équipe</span>
                    <span className="info-value">{materielData?.equipe || 'N/A'}</span>
                  </div>
                </div>
                <div className="info-card">
                  <div className="info-icon">
                    <FaUsers />
                  </div>
                  <div className="info-content">
                    <span className="info-label">Rôle</span>
                    <span className={`badge-role ${roleDisplay.className}`}>{roleDisplay.label}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="profile-col-divider"></div>

            {/* Colonne droite : modification des mots de passe */}
            <div className="profile-col profile-col-password">
              <div className="password-section">
                <h5 className="section-title">
                  <FaExchangeAlt /> Modifier le mot de passe
                </h5>
                {updateStatus.msg && (
                  <Alert variant={updateStatus.type} onClose={() => setUpdateStatus({ type: '', msg: '' })} dismissible className="alert-modern">
                    {updateStatus.msg}
                  </Alert>
                )}
                <Form className="password-form">
                  <Form.Group className="mb-3" controlId="userMailPassword">
                    <Form.Label className="password-label">
                      <FaEnvelopeOpenText /> Nouveau mot de passe
                    </Form.Label>
                    <div className="password-input-wrapper">
                      <Form.Control
                        type={showP1 ? 'text' : 'password'}
                        name="p1"
                        value={newPasswords.p1}
                        onChange={handleInputChange}
                        placeholder="Saisir le nouveau mot de passe UserMail"
                        autoComplete="new-password"
                        className="password-field"
                      />
                      <Button
                        variant="link"
                        className="password-toggle"
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowP1(!showP1)}
                        aria-label={showP1 ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      >
                        {showP1 ? <FaEyeSlash /> : <FaEye />}
                      </Button>
                    </div>
                  </Form.Group>

                  <Form.Group className="mb-3" controlId="userMailPasswordConfirm">
                    <Form.Label className="password-label">
                      <FaCheck /> Confirmer le mot de passe
                    </Form.Label>
                       <div className="password-input-wrapper">
                        <Form.Control
                          type={showP1 ? 'text' : 'password'}
                          name="confirm"
                        value={newPasswords.confirm}
                        onChange={handleInputChange}
                        placeholder="Confirmer le mot de passe UserMail"
                        autoComplete="new-password"
                        className="password-field"
                      />
                      <Button
                        variant="link"
                        className="password-toggle"
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowP1(!showP1)}
                        aria-label={showP1 ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      >
                        {showP1 ? <FaEyeSlash /> : <FaEye />}
                      </Button>
                    </div>
                  </Form.Group>
                </Form>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="modal-footer-modern">
          <Button variant="secondary" onClick={handleCloseProfile} className="btn-secondary-modern">
            Annuler
          </Button>
          <Button variant="primary" onClick={handleUpdatePassword} className="btn-primary-modern" disabled={isUpdating}>
            <FaCheck /> {isUpdating ? 'Mise à jour...' : 'Sauvegarder'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default FixedNavbarWithLogo;
