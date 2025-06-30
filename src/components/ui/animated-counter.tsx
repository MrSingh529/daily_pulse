'use client';

import CountUp from 'react-countup';

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function AnimatedCounter({ value, prefix, suffix, decimals, className }: AnimatedCounterProps) {
  return (
    <CountUp
      end={value}
      duration={2.5}
      separator=","
      prefix={prefix}
      suffix={suffix}
      decimals={decimals}
      decimal="."
      className={className}
      enableScrollSpy
      scrollSpyDelay={200}
    />
  );
}
