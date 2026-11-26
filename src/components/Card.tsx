import type { FC } from 'react'
import { Card as AntdCard, type CardProps } from 'antd'

// antd 5.29 types Card as a ForwardRefExoticComponent whose call signature
// does not satisfy TS's JSX return check under React 19 typings. Re-type it as a
// plain FC at this one boundary so pages can use <Card> normally.
export const Card = AntdCard as unknown as FC<CardProps>
