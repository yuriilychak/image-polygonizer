import { memo, FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageItem } from './image-item';
import { MenuSection } from '../menu-section';
import type { CharAction, ImageActionCallback, ImageData } from '../../types';
import './component.css';

const ACTIONS: CharAction[] = ['add'];

type ImageListProps = {
  images: ImageData[];
  disabled: boolean;
  onImageAction: ImageActionCallback;
};

const ImageList: FC<ImageListProps> = ({ images, disabled, onImageAction }) => {
  const { t } = useTranslation();

  return (
    <MenuSection
      title={t('menu_section_label_image_list')}
      className="image-list-root"
      contentClassName="image-list-content"
      actions={ACTIONS}
      onAction={onImageAction}
    >
      {images.map(({ id, label }) => (
        <ImageItem key={id} id={id} label={label} disabled={disabled} onAction={onImageAction} />
      ))}
    </MenuSection>
  );
};

export default memo(ImageList);
