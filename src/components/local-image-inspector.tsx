'use client';

import { useEffect, useId, useState } from 'react';
import { Image as ImageIcon, Images, Info, X } from 'lucide-react';

type Preview = { name: string; url: string };

export function LocalImageInspector() {
  const inputId = useId();
  const [images, setImages] = useState<Preview[]>([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    return () => {
      images.forEach((image) => URL.revokeObjectURL(image.url));
    };
  }, [images]);

  function load(files: FileList | null) {
    const pngs = Array.from(files || [])
      .filter((file) => file.type === 'image/png' || file.name.toLowerCase().endsWith('.png'))
      .slice(0, 20);
    const next = pngs.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
    setImages(next);
    setSelected(next.find((image) => image.name === 'annotated.png')?.url || next[0]?.url || '');
  }

  const active = images.find((image) => image.url === selected);
  return (
    <section className="local-image-inspector">
      <div className="inspector-heading">
        <div>
          <span className="card-kicker">MANUAL REVIEW</span>
          <h4>Đối chiếu ảnh trên máy</h4>
        </div>
        <label htmlFor={inputId} className="inspector-pick">
          <Images size={15} /> Chọn PNG
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/png,.png"
          multiple
          onChange={(event) => load(event.target.files)}
        />
      </div>
      {active ? (
        <>
          <div className="inspector-stage">
            {/* Blob URLs are local browser files, not remotely optimizable assets. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.url} alt={`Ảnh chẩn đoán ${active.name}`} />
            <span>{active.name}</span>
          </div>
          <div className="inspector-thumbnails">
            {images.map((image) => (
              <button
                key={image.url}
                type="button"
                className={selected === image.url ? 'active' : ''}
                onClick={() => setSelected(image.url)}
                title={image.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" />
                <span>{image.name}</span>
              </button>
            ))}
          </div>
          <button
            className="inspector-clear"
            type="button"
            onClick={() => {
              setImages([]);
              setSelected('');
            }}
          >
            <X size={13} /> Đóng ảnh
          </button>
        </>
      ) : (
        <div className="inspector-empty">
          <ImageIcon size={23} />
          <span>
            Chọn frame.png, annotated.png và các crop của <strong>cùng một sample</strong>.
          </span>
        </div>
      )}
      <p className="inspector-privacy">
        <Info size={13} /> Ảnh chỉ được mở cục bộ trong tab này, không gửi qua API và biến mất khi
        tải lại trang.
      </p>
    </section>
  );
}
