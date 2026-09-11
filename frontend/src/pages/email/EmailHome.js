import React, { useState } from 'react';
import { Container, Row, Col, Tab, ButtonGroup, Button } from 'react-bootstrap';
import { FaCalendarDay, FaCalendarWeek, FaCalendarAlt } from 'react-icons/fa';
import EmailConfigPage from './EmailConfigPage.js';
import EmailConfigWeeklyPage from './EmailConfigWeeklyPage.js';
import EmailConfigMonthlyPage from './EmailConfigMonthlyPage.js';
import { useEmailConfigs } from '../../hooks/useEmailConfigs';
import SavedConfigList from './SavedConfigList';
import './SavedConfigList.css';

const EmailHome = () => {
    const [activeTab, setActiveTab] = useState('quotidien');
    const { daily, weekly, monthly, loading, error, updateConfig } = useEmailConfigs();

    const handleConfigUpdate = (type, data) => {
        updateConfig(type, data);
    };

    return (
        <Container fluid className="py-1">
            <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
                <Row className="mb-2">
                    <Col>
                        <div className="menu-tabs text-center mb-4">
                            <ButtonGroup>
                                <Button
                                    variant={activeTab === 'quotidien' ? 'secondary' : 'outline-secondary'}
                                    onClick={() => setActiveTab('quotidien')}
                                    className="menu-btn d-flex align-items-center gap-2"
                                >
                                    <FaCalendarDay />
                                    Configuration Quotidienne
                                </Button>
                                <Button
                                    variant={activeTab === 'hebdomadaire' ? 'secondary' : 'outline-secondary'}
                                    onClick={() => setActiveTab('hebdomadaire')}
                                    className="menu-btn d-flex align-items-center gap-2"
                                >
                                    <FaCalendarWeek />
                                    Configuration Hebdomadaire
                                </Button>
                                <Button
                                    variant={activeTab === 'mensuelle' ? 'secondary' : 'outline-secondary'}
                                    onClick={() => setActiveTab('mensuelle')}
                                    className="menu-btn d-flex align-items-center gap-2"
                                >
                                    <FaCalendarAlt />
                                    Configuration Mensuelle
                                </Button>
                            </ButtonGroup>
                        </div>
                    </Col>
                </Row>
                
                <Row>
                    <Col md="8">
                        <Tab.Content>
                            <Tab.Pane eventKey="quotidien" active={activeTab === 'quotidien'}>
                                {activeTab === 'quotidien' && (
                                    <EmailConfigPage
                                        initialConfig={daily}
                                        onConfigUpdate={(data) => handleConfigUpdate('quotidien', data)}
                                    />
                                )}
                            </Tab.Pane>
                            <Tab.Pane eventKey="hebdomadaire" active={activeTab === 'hebdomadaire'}>
                                {activeTab === 'hebdomadaire' && (
                                    <EmailConfigWeeklyPage
                                        initialConfig={weekly}
                                        onConfigUpdate={(data) => handleConfigUpdate('hebdomadaire', data)}
                                    />
                                )}
                            </Tab.Pane>
                            <Tab.Pane eventKey="mensuelle" active={activeTab === 'mensuelle'}>
                                {activeTab === 'mensuelle' && (
                                    <EmailConfigMonthlyPage
                                        initialConfig={monthly}
                                        onConfigUpdate={(data) => handleConfigUpdate('mensuelle', data)}
                                    />
                                )}
                            </Tab.Pane>
                        </Tab.Content>
                    </Col>
                    <Col md="4">
                        {loading && (
                            <div className="text-center p-4 text-muted">
                                Chargement des configurations...
                            </div>
                        )}
                        {error && (
                            <div className="alert alert-danger">
                                Erreur: {error}
                            </div>
                        )}
                        {!loading && !error && <SavedConfigList configs={{ daily, weekly, monthly }} activeTab={activeTab} />}
                    </Col>
                </Row>
            </Tab.Container>
        </Container>
    );
};

export default EmailHome;