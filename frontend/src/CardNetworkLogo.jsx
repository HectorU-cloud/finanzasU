import {
  SiVisa,
  SiMastercard,
  SiAmericanexpress,
  SiDinersclub,
} from "react-icons/si";

const LOGOS = {
  Visa: SiVisa,
  Mastercard: SiMastercard,
  "American Express": SiAmericanexpress,
  "Diners Club": SiDinersclub,
};

export default function CardNetworkLogo({ red, size = 32, color = "currentColor" }) {
  const Icono = LOGOS[red];
  if (!Icono) return null;
  return <Icono size={size} color={color} title={red} />;
}