import { memo, FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageItem } from './image-item';
import { MenuSection } from '../menu-section';
import type { CharAction, ImageActionCallback, ImageConfig } from '../../types';
import './component.css';

const ACTIONS: CharAction[] = ['add'];

type ImageListProps = {
    currentImageId: string;
  images: ImageConfig[];
  disabled: boolean;
  onImageAction: ImageActionCallback;
};

const ImageList: FC<ImageListProps> = ({ images, disabled, onImageAction, currentImageId }) => {
  const { t } = useTranslation();

  return (
    <MenuSection
      title={t('menu_section_label_image_list')}
      className="image-list-root"
      contentClassName="image-list-content"
      actions={ACTIONS}
      onAction={onImageAction}
    >
      {images.map(({ id, label, selected }) => (
        <ImageItem key={id} id={id} label={label} disabled={disabled} onAction={onImageAction} isCurrent={id === currentImageId} selected={selected} />
      ))}
    </MenuSection>
  );
};

export default memo(ImageList);
