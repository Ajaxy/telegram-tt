use ab_glyph::{FontRef, PxScale};
use image::{Rgba, RgbaImage, imageops};
use imageproc::drawing::{draw_filled_circle_mut, draw_filled_rect_mut, draw_text_mut, text_size};
use imageproc::filter::gaussian_blur_f32;
use imageproc::rect::Rect;
use std::io::Cursor;
use tauri::image::Image;

static FONT: &[u8] = include_bytes!("../../fonts/Roboto-Bold.ttf");

const BADGE_BACKGROUND_COLOR: Rgba<u8> = Rgba([0xF2, 0x3C, 0x34, 0xFF]);
const BADGE_BACKGROUND_COLOR_MUTED: Rgba<u8> = Rgba([0x88, 0x88, 0x88, 0xFF]);
const BADGE_TEXT_COLOR: Rgba<u8> = Rgba([0xFF, 0xFF, 0xFF, 0xFF]);

pub fn set_badge_count_icon(window: &tauri::WebviewWindow, amount: i32, is_muted: bool) {
  if amount == 0 {
    window.set_overlay_icon(None).unwrap_or_default();

    if let Ok(tray_opt) = super::TRAY_HANDLE.lock() {
      if let Some(tray) = tray_opt.as_ref() {
        let _ = tray.set_icon(Some(super::TRAY_BASE_ICON.clone()));
      }
    }
  } else {
    let png = generate_counter_png(48, amount, is_muted);
    let converted = Image::from_bytes(&png);

    if let Ok(converted) = converted {
      window.set_overlay_icon(Some(converted)).unwrap_or_default();
    } else {
      log::error!("Failed to convert notification icon: {:?}", converted.err());
      window.set_overlay_icon(None).unwrap_or_default();
    }

    // Update tray icon with counter overlay
    if let Ok(tray_opt) = super::TRAY_HANDLE.lock() {
      if let Some(tray) = tray_opt.as_ref() {
        let base_icon = &super::TRAY_BASE_ICON;
        let counter_size = (base_icon.width() as f32 * 0.6).floor() as u32;
        let counter_icon = generate_counter_png(counter_size, amount, is_muted);
        let counter_icon = Image::from_bytes(&counter_icon).unwrap();
        let overlay_icon = overlay_tray_icon(base_icon, &counter_icon);
        let _ = tray.set_icon(Some(overlay_icon));
      }
    }
  }
}

pub fn generate_counter_png(size: u32, count: i32, is_muted: bool) -> Vec<u8> {
  let background_color = if is_muted {
    BADGE_BACKGROUND_COLOR_MUTED
  } else {
    BADGE_BACKGROUND_COLOR
  };

  // Prepare text properties
  let (text, font, scale, text_width, text_height) = if count >= 0 {
    let text = if count < 100 {
      count.to_string()
    } else {
      format!("..{:02}", count % 100)
    };

    let font = FontRef::try_from_slice(FONT).expect("Invalid font");
    let scale = {
      let base = if text.len() < 3 { 0.9 } else { 0.75 };
      let calculated_scale = (base * size as f32).ceil();
      PxScale::from(calculated_scale)
    };

    let (text_width, text_height) = text_size(scale, &font, &text);
    (Some(text), Some(font), Some(scale), text_width, text_height)
  } else {
    (None, None, None, 0, 0)
  };

  // Calculate badge dimensions
  let (badge_width, badge_height) = if count >= 0 {
    let padding = size / 10;
    let min_dimension = size;

    let content_width = text_width + padding * 2;
    let content_height = text_height + padding * 2;

    let width = content_width.max(min_dimension);
    let height = content_height.max(min_dimension);

    (width, height)
  } else {
    (size, size)
  };

  let edge_space = if let Some(scale) = scale {
    ((scale.y / 10.0).ceil() as u32).max(1)
  } else {
    1
  };

  let img_width = badge_width + edge_space * 2;
  let img_height = badge_height + edge_space * 2;
  let mut img = RgbaImage::from_pixel(img_width, img_height, Rgba([0, 0, 0, 0]));

  let corner_radius = if count < 0 {
    badge_width.min(badge_height) / 2
  } else {
    badge_height / 2
  };

  draw_rounded_rect(
    &mut img,
    edge_space,
    edge_space,
    badge_width,
    badge_height,
    corner_radius,
    background_color,
  );

  // Apply gaussian blur for antialiasing effect
  img = gaussian_blur_f32(&img, 0.75);

  if let (Some(text), Some(font), Some(scale)) = (text, font, scale) {
    let x = edge_space as f32 + ((badge_width as f32 - text_width as f32) / 2.0).ceil();

    let baseline_offset = scale.y * 0.15;
    let y = edge_space as f32
      + ((badge_height as f32 - text_height as f32) / 2.0 - baseline_offset).ceil();

    draw_text_mut(
      &mut img,
      BADGE_TEXT_COLOR,
      x as i32,
      y as i32,
      scale,
      &font,
      &text,
    );
  }

  let mut buffer = Vec::new();
  let mut cursor = Cursor::new(&mut buffer);
  img
    .write_to(&mut cursor, image::ImageFormat::Png)
    .expect("PNG encode failed");
  buffer
}

pub fn overlay_tray_icon(icon: &Image, counter: &Image) -> Image<'static> {
  let icon_rgba = icon.rgba();
  let counter_rgba = counter.rgba();

  let icon_img = image::RgbaImage::from_raw(icon.width(), icon.height(), icon_rgba.to_vec())
    .expect("Failed to create RgbaImage from icon data");

  let counter_img =
    image::RgbaImage::from_raw(counter.width(), counter.height(), counter_rgba.to_vec())
      .expect("Failed to create RgbaImage from counter data");

  let mut result = icon_img.clone();

  let icon_width = result.width();
  let icon_height = result.height();
  let counter_width = counter_img.width();
  let counter_height = counter_img.height();

  let padding = 0;
  let x = icon_width.saturating_sub(counter_width + padding);
  let y = icon_height.saturating_sub(counter_height + padding);

  // Overlay the counter image onto the icon
  imageops::overlay(&mut result, &counter_img, x.into(), y.into());

  // Convert back to tauri Image
  let mut buffer = Vec::new();
  let mut cursor = Cursor::new(&mut buffer);
  result
    .write_to(&mut cursor, image::ImageFormat::Png)
    .expect("PNG encode failed");

  Image::from_bytes(&buffer).expect("Failed to create Image from bytes")
}

fn draw_rounded_rect(
  img: &mut RgbaImage,
  x: u32,
  y: u32,
  width: u32,
  height: u32,
  radius: u32,
  color: Rgba<u8>,
) {
  let radius = radius.min(width / 2).min(height / 2);

  if radius == 0 {
    draw_filled_rect_mut(
      img,
      Rect::at(x as i32, y as i32).of_size(width, height),
      color,
    );
    return;
  }

  if width > 2 * radius && height > 2 * radius {
    draw_filled_rect_mut(
      img,
      Rect::at((x + radius) as i32, (y + radius) as i32)
        .of_size(width - 2 * radius, height - 2 * radius),
      color,
    );
  }

  if width > 2 * radius {
    draw_filled_rect_mut(
      img,
      Rect::at((x + radius) as i32, y as i32).of_size(width - 2 * radius, radius),
      color,
    );
    draw_filled_rect_mut(
      img,
      Rect::at((x + radius) as i32, (y + height - radius) as i32)
        .of_size(width - 2 * radius, radius),
      color,
    );
  }

  if height > 2 * radius {
    draw_filled_rect_mut(
      img,
      Rect::at(x as i32, (y + radius) as i32).of_size(radius, height - 2 * radius),
      color,
    );
    draw_filled_rect_mut(
      img,
      Rect::at((x + width - radius) as i32, (y + radius) as i32)
        .of_size(radius, height - 2 * radius),
      color,
    );
  }

  let radius_i32 = radius as i32;

  draw_filled_circle_mut(
    img,
    ((x + radius) as i32, (y + radius) as i32),
    radius_i32,
    color,
  );
  draw_filled_circle_mut(
    img,
    ((x + width - radius) as i32, (y + radius) as i32),
    radius_i32,
    color,
  );
  draw_filled_circle_mut(
    img,
    ((x + radius) as i32, (y + height - radius) as i32),
    radius_i32,
    color,
  );
  draw_filled_circle_mut(
    img,
    ((x + width - radius) as i32, (y + height - radius) as i32),
    radius_i32,
    color,
  );
}
