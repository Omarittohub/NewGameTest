import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Card as CardType } from '@shared/types';

interface CardProps {
    card: CardType;
    draggable?: boolean;
}

export const Card: React.FC<CardProps> = ({ card, draggable = false }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: card.id,
        disabled: !draggable,
        data: { card } // Pass card data for drop handler
    });

    const style: React.CSSProperties = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
    } : {};

    // Image source logic
    // If isHidden is true, show back.jpeg
    // If we are looking at opponent's card (in hand?) logic handled by Game state masking already?
    // Game.ts: "Mask hand... map(c => ... image: back.jpeg)". So `card.image` comes from server correct.

    const imgSrc = `/assets/${card.isHidden ? 'back.jpeg' : card.image}`;

    const typeLabel = (() => {
        switch (card.type) {
            case 'N': return 'Normal';
            case 'X2': return '×2';
            case 'S': return 'Shield';
            case 'K': return 'Killer';
            case 'T': return 'Espion';
            default: return card.type;
        }
    })();

    return (
        <div className="flex flex-col items-center">
            <div
                ref={setNodeRef}
                style={style}
                {...listeners}
                {...attributes}
                className={`
        relative
        w-[72px] h-[108px] sm:w-[88px] sm:h-[132px] md:w-[96px] md:h-[144px]
        rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.55)] ring-1 ring-white/15 bg-black/30 overflow-hidden
        ${draggable ? 'cursor-grab active:cursor-grabbing hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(0,0,0,0.65)] transition-all' : ''}
      `}
            >
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-white/0 via-white/0 to-white/12" />
                <img
                    src={imgSrc}
                    alt={card.id}
                    className="w-full h-full object-cover"
                    draggable={false}
                />
            </div>

            {!card.isHidden && (
                <div className="mt-1 px-2 py-[2px] rounded-full bg-black/40 ring-1 ring-white/10 text-[10px] text-white/85">
                    {typeLabel}
                </div>
            )}
        </div>
    );
};
