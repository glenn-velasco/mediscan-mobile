// Always check for typos and sync it with app/Enums/IdType.php
export const IdType = {
  PhPrc: 'ph_prc',
} as const;

export type IdType = (typeof IdType)[keyof typeof IdType];

export const IdTypeLabel: Record<IdType, string> = {
  ph_prc: 'PRC ID (Philippines)',
};

export const ID_TYPE_OPTIONS = Object.values(IdType) as IdType[];
