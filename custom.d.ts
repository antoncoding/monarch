declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: import('next/dist/shared/lib/image-external').StaticImageData;
  export default src;
}

declare module '*.jpg' {
  const src: import('next/dist/shared/lib/image-external').StaticImageData;
  export default src;
}

declare module '*.jpeg' {
  const src: import('next/dist/shared/lib/image-external').StaticImageData;
  export default src;
}

declare module '*.gif' {
  const src: import('next/dist/shared/lib/image-external').StaticImageData;
  export default src;
}

declare module '*.webp' {
  const src: import('next/dist/shared/lib/image-external').StaticImageData;
  export default src;
}

declare module '*.avif' {
  const src: import('next/dist/shared/lib/image-external').StaticImageData;
  export default src;
}

declare module '*.ico' {
  const src: import('next/dist/shared/lib/image-external').StaticImageData;
  export default src;
}

declare module '*.bmp' {
  const src: import('next/dist/shared/lib/image-external').StaticImageData;
  export default src;
}
