import {
  FaQrcode, FaLaptop, FaTv, FaUsers, FaCalendarAlt, FaBuilding, FaDoorOpen,
  FaHeart, FaUserCircle, FaTerminal, FaDesktop, FaKey, FaShieldAlt,
  FaBatteryFull, FaMicrochip, FaCommentAlt, FaHdd,
} from 'react-icons/fa';
import { MdMonitor } from 'react-icons/md';

const MATERIEL_FIELD_ICONS = {
  id_n: FaQrcode,
  id_marque: FaLaptop,
  ecran: FaTv,
  equipe: FaUsers,
  date_pc: FaCalendarAlt,
  date_ecran: MdMonitor,
  salle: FaBuilding,
  id_local: FaDoorOpen,
  etat_pc: FaHeart,
  utilisateur: FaUserCircle,
  code_pc: FaTerminal,
  code_ecran: FaDesktop,
  mdp_pc: FaKey,
  mdp_admin: FaShieldAlt,
  etat_batterie: FaBatteryFull,
  caracteristiques: FaMicrochip,
  commentaire: FaCommentAlt,
};

export const getMaterielFieldIcon = (name) => MATERIEL_FIELD_ICONS[name] || FaHdd;
