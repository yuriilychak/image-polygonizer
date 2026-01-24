import { memo, FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageItem } from './image-item';
import { MenuSection } from '../menu-section';
import type { ReducerAction, ImageActionCallback, ImageConfig } from '../../types';
import './component.css';

const ACTIONS: ReducerAction[] = ['addImages'];

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
      disabled={disabled}
    >
      {images.map(({ id, label, selected, outdated, hasPolygons, type }) => (
        <ImageItem
          type={type}
          key={id}
          id={id}
          label={label}
          disabled={disabled}
          onAction={onImageAction}
          isCurrent={id === currentImageId}
          selected={selected}
          outdated={outdated}
          hasPolygons={hasPolygons}
        />
      ))}
    </MenuSection>
  );
};

export default memo(ImageList);
