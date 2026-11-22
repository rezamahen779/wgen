import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export default function DockIcon({ mouseX, icon: Icon, label, isActive, onClick, currentTheme }) {
  const ref = useRef(null);

  // Hitung jarak kursor ke tengah-tengah ikon (hanya jalan di desktop)
  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  // Skala membesar dinamis (Mouse dekat = besar, jauh = normal)
  const widthSync = useTransform(distance, [-150, 0, 150], [44, 68, 44]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 300, damping: 15 });

  return (
    <motion.button
      ref={ref}
      style={{ width, height: width }}
      onClick={onClick}
      // Khusus HP / Touch: Efek membal pas ditap
      whileTap={{ scale: 0.8, rotate: -5 }}
      whileHover={{ y: -10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 14 }}
      className={`group relative flex flex-col items-center justify-center rounded-2xl transition-colors cursor-pointer ${
        isActive 
          ? `bg-gray-800/90 text-white shadow-lg border border-white/20` 
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
      }`}
    >
      {/* Tooltip macOS */}
      <span className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-900/90 border border-white/10 text-white text-[9px] font-bold px-2.5 py-1 rounded-lg shadow-xl pointer-events-none whitespace-nowrap">
        {label}
      </span>

      <Icon className="w-5 h-5 shrink-0" />

      {/* Indikator Titik Menyala macOS */}
      {isActive && (
        <motion.span 
          layoutId="activeDot"
          className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-gradient-to-r ${currentTheme.btn} shadow-[0_0_8px_rgba(59,130,246,0.9)]`}
        />
      )}
    </motion.button>
  );
}