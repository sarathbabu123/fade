import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme';

interface IconProps {
  color?: string;
  size?: number;
}

const stroke = (color: string) => ({
  stroke: color,
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
});

export function PlayIcon({ color = colors.text, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 4.8 L19 12 L7 19.2 Z" {...stroke(color)} />
    </Svg>
  );
}

export function FriendsIcon({ color = colors.text, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={9} cy={8.5} r={3.5} {...stroke(color)} />
      <Path d="M2.5 19.5 C3.5 15.5 6 14 9 14 C12 14 14.5 15.5 15.5 19.5" {...stroke(color)} />
      <Path d="M15.5 5.3 A3.3 3.3 0 0 1 15.5 11.7 M17.5 14.3 C19.6 15 21 16.7 21.5 19.5" {...stroke(color)} />
    </Svg>
  );
}

export function ProfileIcon({ color = colors.text, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={8.5} r={4} {...stroke(color)} />
      <Path d="M4.5 20.5 C5.5 16 8.5 14.3 12 14.3 C15.5 14.3 18.5 16 19.5 20.5" {...stroke(color)} />
    </Svg>
  );
}

export function GearIcon({ color = colors.text, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={3} {...stroke(color)} />
      <Path
        d="M12 2.8 V5.2 M12 18.8 V21.2 M2.8 12 H5.2 M18.8 12 H21.2 M5.5 5.5 L7.2 7.2 M16.8 16.8 L18.5 18.5 M5.5 18.5 L7.2 16.8 M16.8 7.2 L18.5 5.5"
        {...stroke(color)}
      />
      <Circle cx={12} cy={12} r={6.8} {...stroke(color)} />
    </Svg>
  );
}

export function BotIcon({ color = colors.text, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 9 H19 V19 H5 Z M12 9 V5.5 M9 13.5 V14.5 M15 13.5 V14.5 M9.5 17 H14.5" {...stroke(color)} />
      <Circle cx={12} cy={4.5} r={1} {...stroke(color)} />
    </Svg>
  );
}

export function PassIcon({ color = colors.text, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 3.5 H16 V20.5 H8 Z M11 17.5 H13" {...stroke(color)} />
      <Path d="M3 9 L5.5 11.5 L3 14 M21 9 L18.5 11.5 L21 14" {...stroke(color)} />
    </Svg>
  );
}

export function SwordsIcon({ color = colors.text, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 4 L14 14 M4 4 H8 M4 4 V8 M20 4 L10 14 M20 4 H16 M20 4 V8" {...stroke(color)} />
      <Path d="M12.5 16.5 L16.5 12.5 M11.5 12.5 L7.5 16.5 M15 15 L19.5 19.5 M9 15 L4.5 19.5" {...stroke(color)} />
    </Svg>
  );
}

export function KeyIcon({ color = colors.text, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3.5 7 H20.5 V17 H3.5 Z" {...stroke(color)} />
      <Path d="M7 12 H7.01 M10.5 12 H10.51 M14 12 H14.01 M17.5 12 H17.51" {...stroke(color)} strokeWidth={2.6} />
    </Svg>
  );
}

export function CrownIcon({ color = colors.gold, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 18 L3 8 L8 12 L12 5 L16 12 L21 8 L20 18 Z" {...stroke(color)} />
    </Svg>
  );
}
