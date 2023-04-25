/*
 * Copyright (C) 2021 Yahweasel
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

/**
 * Frames, as taken/given by libav.js.
 */
export interface Frame {
    /**
     * The actual frame data. For non-planar audio data, this is a typed array.
     * For planar audio data, this is an array of typed arrays, one per plane.
     * For video data, this is an array of planes, where each plane is in turn
     * an array of typed arrays, one per line (because of how libav buffers
     * lines).
     */
    data: any[];

    /**
     * Sample format or pixel format.
     */
    format: number;

    /**
     * Presentation timestamp for this frame. Units depends on surrounding
     * context. Will always be set by libav.js, but libav.js will accept frames
     * from outside that do not have this set.
     */
    pts?: number, ptshi?: number;

    /**
     * Audio only. Channel layout. It is possible for only one of this and
     * channels to be set.
     */
    channel_layout?: number;

    /**
     * Audio only. Number of channels. It is possible for only one of this and
     * channel_layout to be set.
     */
    channels?: number;

    /**
     * Audio only. Number of samples in the frame.
     */
    nb_samples?: number;

    /**
     * Audio only. Sample rate.
     */
    sample_rate?: number;

    /**
     * Video only. Width of frame.
     */
    width?: number;

    /**
     * Video only. Height of frame.
     */
    height?: number;

    /**
     * Video only. Sample aspect ratio (pixel aspect ratio), as a numerator and
     * denominator. 0 is interpreted as 1 (square pixels).
     */
    sample_aspect_ratio?: [number, number];

    /**
     * Is this a keyframe? (1=yes, 0=maybe)
     */
    key_frame?: number;

    /**
     * Picture type (libav-specific value)
     */
    pict_type?: number;
}

/**
 * Packets, as taken/given by libav.js.
 */
export interface Packet {
    /**
     * The actual data represented by this packet.
     */
    data: Uint8Array;

    /**
     * Presentation timestamp.
     */
    pts?: number, ptshi?: number;

    /**
     * Decoding timestamp.
     */
    dts?: number, dtshi?: number;

    /**
     * Index of this stream within a surrounding muxer/demuxer.
     */
    stream_index?: number;

    /**
     * Packet flags, as defined by ffmpeg.
     */
    flags?: number;

    /**
     * Duration of this packet. Rarely used.
     */
    duration?: number, durationhi?: number;

    /**
     * Side data. Codec-specific.
     */
    side_data?: any;
}

/**
 * Stream information, as returned by ff_init_demuxer_file.
 */
export interface Stream {
    /**
     * Index of this stream.
     */
    index: number;

    /**
     * Codec parameters.
     */
    codecpar: number;

    /**
     * Type of codec (audio or video, typically)
     */
    codec_type: number;

    /**
     * Codec identifier.
     */
    codec_id: number;

    /**
     * Base for timestamps of packets in this stream.
     */
    time_base_num: number, time_base_den: number;

    /**
     * Duration of this stream in time_base units.
     */
    duration_time_base: number;

    /**
     * Duration of this stream in seconds.
     */
    duration: number;
}

/**
 * Settings used to set up a filter.
 */
export interface FilterIOSettings {
    /**
     * Audio only. Sample rate of the input.
     */
    sample_rate?: number;

    /**
     * Audio only. Sample format of the input.
     */
    sample_fmt?: number;

    /**
     * Audio only. Channel layout of the input. Note that there is no
     * "channels"; you must describe a layout.
     */
    channel_layout?: number;

    /**
     * Audio only, output only, optional. Size of an audio frame.
     */
    frame_size?: number;
}

/**
 * Supported properties of an AVCodecContext, used by ff_init_encoder.
 */
export interface AVCodecContextProps {
    bit_rate?: number;
    bit_ratehi?: number;
    channel_layout?: number;
    channel_layouthi?: number;
    channels?: number;
    frame_size?: number;
    framerate_num?: number;
    framerate_den?: number;
    gop_size?: number;
    height?: number;
    keyint_min?: number;
    level?: number;
    pix_fmt?: number;
    profile?: number;
    rc_max_rate?: number;
    rc_max_ratehi?: number;
    rc_min_rate?: number;
    rc_min_ratehi?: number;
    sample_aspect_ratio_num?: number;
    sample_aspect_ratio_den?: number;
    sample_fmt?: number;
    sample_rate?: number;
    qmax?: number;
    qmin?: number;
    width?: number;
}

export interface LibAV {
av_get_bytes_per_sample(a0: number): Promise<number>;
av_opt_set_int_list_js(a0: number,a1: string,a2: number,a3: number,a4: number,a5: number): Promise<number>;
av_frame_alloc(): Promise<number>;
av_frame_free(a0: number): Promise<void>;
av_frame_get_buffer(a0: number,a1: number): Promise<number>;
av_frame_make_writable(a0: number): Promise<number>;
av_frame_unref(a0: number): Promise<void>;
av_packet_alloc(): Promise<number>;
av_packet_free(a0: number): Promise<void>;
av_packet_new_side_data(a0: number,a1: number,a2: number): Promise<number>;
av_packet_unref(a0: number): Promise<void>;
av_strdup(a0: string): Promise<number>;
av_buffersink_get_frame(a0: number,a1: number): Promise<number>;
av_buffersink_set_frame_size(a0: number,a1: number): Promise<void>;
av_buffersrc_add_frame_flags(a0: number,a1: number,a2: number): Promise<number>;
avfilter_free(a0: number): Promise<void>;
avfilter_get_by_name(a0: string): Promise<number>;
avfilter_graph_alloc(): Promise<number>;
avfilter_graph_config(a0: number,a1: number): Promise<number>;
avfilter_graph_create_filter_js(a0: number,a1: string,a2: string,a3: number,a4: number): Promise<number>;
avfilter_graph_free(a0: number): Promise<void>;
avfilter_graph_parse(a0: number,a1: string,a2: number,a3: number,a4: number): Promise<number>;
avfilter_inout_alloc(): Promise<number>;
avfilter_inout_free(a0: number): Promise<void>;
avfilter_link(a0: number,a1: number,a2: number,a3: number): Promise<number>;
avcodec_alloc_context3(a0: number): Promise<number>;
avcodec_close(a0: number): Promise<number>;
avcodec_find_decoder(a0: number): Promise<number>;
avcodec_find_decoder_by_name(a0: string): Promise<number>;
avcodec_find_encoder(a0: number): Promise<number>;
avcodec_find_encoder_by_name(a0: string): Promise<number>;
avcodec_free_context(a0: number): Promise<void>;
avcodec_get_name(a0: number): Promise<string>;
avcodec_open2(a0: number,a1: number,a2: number): Promise<number>;
ff_calloc_AVCodecParameters(): Promise<number>;
avcodec_parameters_from_context(a0: number,a1: number): Promise<number>;
avcodec_parameters_to_context(a0: number,a1: number): Promise<number>;
avcodec_receive_frame(a0: number,a1: number): Promise<number>;
avcodec_receive_packet(a0: number,a1: number): Promise<number>;
avcodec_send_frame(a0: number,a1: number): Promise<number>;
avcodec_send_packet(a0: number,a1: number): Promise<number>;
av_find_input_format(a0: string): Promise<number>;
avformat_alloc_context(): Promise<number>;
avformat_alloc_output_context2_js(a0: number,a1: string,a2: string): Promise<number>;
avformat_close_input(a0: number): Promise<void>;
avformat_find_stream_info(a0: number,a1: number): Promise<number>;
avformat_free_context(a0: number): Promise<void>;
avformat_new_stream(a0: number,a1: number): Promise<number>;
avformat_open_input(a0: number,a1: string,a2: number,a3: number): Promise<number>;
avformat_open_input_js(a0: string,a1: number,a2: number): Promise<number>;
avformat_write_header(a0: number,a1: number): Promise<number>;
avio_open2_js(a0: string,a1: number,a2: number,a3: number): Promise<number>;
avio_close(a0: number): Promise<number>;
av_find_best_stream(a0: number,a1: number,a2: number,a3: number,a4: number,a5: number): Promise<number>;
av_grow_packet(a0: number,a1: number): Promise<number>;
av_interleaved_write_frame(a0: number,a1: number): Promise<number>;
av_packet_make_writable(a0: number): Promise<number>;
av_pix_fmt_desc_get(a0: number): Promise<number>;
av_read_frame(a0: number,a1: number): Promise<number>;
av_shrink_packet(a0: number,a1: number): Promise<void>;
av_write_frame(a0: number,a1: number): Promise<number>;
av_write_trailer(a0: number): Promise<number>;
av_dict_set(a0: number,a1: string,a2: string,a3: number): Promise<number>;
av_dict_free(a0: number): Promise<void>;
sws_getContext(a0: number,a1: number,a2: number,a3: number,a4: number,a5: number,a6: number,a7: number,a8: number,a9: number): Promise<number>;
sws_freeContext(a0: number): Promise<void>;
sws_scale_frame(a0: number,a1: number,a2: number): Promise<number>;
AVFrame_sample_aspect_ratio_num(a0: number): Promise<number>;
AVFrame_sample_aspect_ratio_den(a0: number): Promise<number>;
AVFrame_sample_aspect_ratio_s(a0: number,a1: number,a2: number): Promise<void>;
AVCodecContext_framerate_num(a0: number): Promise<number>;
AVCodecContext_framerate_den(a0: number): Promise<number>;
AVCodecContext_framerate_num_s(a0: number,a1: number): Promise<void>;
AVCodecContext_framerate_den_s(a0: number,a1: number): Promise<void>;
AVCodecContext_framerate_s(a0: number,a1: number,a2: number): Promise<void>;
AVCodecContext_sample_aspect_ratio_num(a0: number): Promise<number>;
AVCodecContext_sample_aspect_ratio_den(a0: number): Promise<number>;
AVCodecContext_sample_aspect_ratio_num_s(a0: number,a1: number): Promise<void>;
AVCodecContext_sample_aspect_ratio_den_s(a0: number,a1: number): Promise<void>;
AVCodecContext_sample_aspect_ratio_s(a0: number,a1: number,a2: number): Promise<void>;
AVCodecContext_time_base_s(a0: number,a1: number,a2: number): Promise<void>;
AVStream_time_base_num(a0: number): Promise<number>;
AVStream_time_base_den(a0: number): Promise<number>;
AVStream_time_base_s(a0: number,a1: number,a2: number): Promise<void>;
AVPacketSideData_data(a0: number,a1: number): Promise<number>;
AVPacketSideData_size(a0: number,a1: number): Promise<number>;
AVPacketSideData_type(a0: number,a1: number): Promise<number>;
ff_error(a0: number): Promise<string>;
ff_nothing(): Promise<void>;
calloc(a0: number,a1: number): Promise<number>;
free(a0: number): Promise<void>;
malloc(a0: number): Promise<number>;
mallinfo_uordblks(): Promise<number>;
libavjs_with_swscale(): Promise<number>;
AVFrame_channel_layout(ptr: number): Promise<number>;
AVFrame_channel_layout_s(ptr: number, val: number): Promise<void>;
AVFrame_channel_layouthi(ptr: number): Promise<number>;
AVFrame_channel_layouthi_s(ptr: number, val: number): Promise<void>;
AVFrame_channels(ptr: number): Promise<number>;
AVFrame_channels_s(ptr: number, val: number): Promise<void>;
AVFrame_data_a(ptr: number, idx: number): Promise<number>;
AVFrame_data_a_s(ptr: number, idx: number, val: number): Promise<void>;
AVFrame_format(ptr: number): Promise<number>;
AVFrame_format_s(ptr: number, val: number): Promise<void>;
AVFrame_height(ptr: number): Promise<number>;
AVFrame_height_s(ptr: number, val: number): Promise<void>;
AVFrame_key_frame(ptr: number): Promise<number>;
AVFrame_key_frame_s(ptr: number, val: number): Promise<void>;
AVFrame_linesize_a(ptr: number, idx: number): Promise<number>;
AVFrame_linesize_a_s(ptr: number, idx: number, val: number): Promise<void>;
AVFrame_nb_samples(ptr: number): Promise<number>;
AVFrame_nb_samples_s(ptr: number, val: number): Promise<void>;
AVFrame_pict_type(ptr: number): Promise<number>;
AVFrame_pict_type_s(ptr: number, val: number): Promise<void>;
AVFrame_pts(ptr: number): Promise<number>;
AVFrame_pts_s(ptr: number, val: number): Promise<void>;
AVFrame_ptshi(ptr: number): Promise<number>;
AVFrame_ptshi_s(ptr: number, val: number): Promise<void>;
AVFrame_sample_rate(ptr: number): Promise<number>;
AVFrame_sample_rate_s(ptr: number, val: number): Promise<void>;
AVFrame_width(ptr: number): Promise<number>;
AVFrame_width_s(ptr: number, val: number): Promise<void>;
AVPixFmtDescriptor_log2_chroma_h(ptr: number): Promise<number>;
AVPixFmtDescriptor_log2_chroma_h_s(ptr: number, val: number): Promise<void>;
AVCodecContext_bit_rate(ptr: number): Promise<number>;
AVCodecContext_bit_rate_s(ptr: number, val: number): Promise<void>;
AVCodecContext_bit_ratehi(ptr: number): Promise<number>;
AVCodecContext_bit_ratehi_s(ptr: number, val: number): Promise<void>;
AVCodecContext_channel_layout(ptr: number): Promise<number>;
AVCodecContext_channel_layout_s(ptr: number, val: number): Promise<void>;
AVCodecContext_channel_layouthi(ptr: number): Promise<number>;
AVCodecContext_channel_layouthi_s(ptr: number, val: number): Promise<void>;
AVCodecContext_channels(ptr: number): Promise<number>;
AVCodecContext_channels_s(ptr: number, val: number): Promise<void>;
AVCodecContext_extradata(ptr: number): Promise<number>;
AVCodecContext_extradata_s(ptr: number, val: number): Promise<void>;
AVCodecContext_extradata_size(ptr: number): Promise<number>;
AVCodecContext_extradata_size_s(ptr: number, val: number): Promise<void>;
AVCodecContext_frame_size(ptr: number): Promise<number>;
AVCodecContext_frame_size_s(ptr: number, val: number): Promise<void>;
AVCodecContext_gop_size(ptr: number): Promise<number>;
AVCodecContext_gop_size_s(ptr: number, val: number): Promise<void>;
AVCodecContext_height(ptr: number): Promise<number>;
AVCodecContext_height_s(ptr: number, val: number): Promise<void>;
AVCodecContext_keyint_min(ptr: number): Promise<number>;
AVCodecContext_keyint_min_s(ptr: number, val: number): Promise<void>;
AVCodecContext_level(ptr: number): Promise<number>;
AVCodecContext_level_s(ptr: number, val: number): Promise<void>;
AVCodecContext_pix_fmt(ptr: number): Promise<number>;
AVCodecContext_pix_fmt_s(ptr: number, val: number): Promise<void>;
AVCodecContext_profile(ptr: number): Promise<number>;
AVCodecContext_profile_s(ptr: number, val: number): Promise<void>;
AVCodecContext_rc_max_rate(ptr: number): Promise<number>;
AVCodecContext_rc_max_rate_s(ptr: number, val: number): Promise<void>;
AVCodecContext_rc_max_ratehi(ptr: number): Promise<number>;
AVCodecContext_rc_max_ratehi_s(ptr: number, val: number): Promise<void>;
AVCodecContext_rc_min_rate(ptr: number): Promise<number>;
AVCodecContext_rc_min_rate_s(ptr: number, val: number): Promise<void>;
AVCodecContext_rc_min_ratehi(ptr: number): Promise<number>;
AVCodecContext_rc_min_ratehi_s(ptr: number, val: number): Promise<void>;
AVCodecContext_sample_fmt(ptr: number): Promise<number>;
AVCodecContext_sample_fmt_s(ptr: number, val: number): Promise<void>;
AVCodecContext_sample_rate(ptr: number): Promise<number>;
AVCodecContext_sample_rate_s(ptr: number, val: number): Promise<void>;
AVCodecContext_qmax(ptr: number): Promise<number>;
AVCodecContext_qmax_s(ptr: number, val: number): Promise<void>;
AVCodecContext_qmin(ptr: number): Promise<number>;
AVCodecContext_qmin_s(ptr: number, val: number): Promise<void>;
AVCodecContext_width(ptr: number): Promise<number>;
AVCodecContext_width_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_codec_id(ptr: number): Promise<number>;
AVCodecParameters_codec_id_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_codec_type(ptr: number): Promise<number>;
AVCodecParameters_codec_type_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_extradata(ptr: number): Promise<number>;
AVCodecParameters_extradata_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_extradata_size(ptr: number): Promise<number>;
AVCodecParameters_extradata_size_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_format(ptr: number): Promise<number>;
AVCodecParameters_format_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_bit_rate(ptr: number): Promise<number>;
AVCodecParameters_bit_rate_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_profile(ptr: number): Promise<number>;
AVCodecParameters_profile_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_level(ptr: number): Promise<number>;
AVCodecParameters_level_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_width(ptr: number): Promise<number>;
AVCodecParameters_width_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_height(ptr: number): Promise<number>;
AVCodecParameters_height_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_color_range(ptr: number): Promise<number>;
AVCodecParameters_color_range_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_color_primaries(ptr: number): Promise<number>;
AVCodecParameters_color_primaries_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_color_trc(ptr: number): Promise<number>;
AVCodecParameters_color_trc_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_color_space(ptr: number): Promise<number>;
AVCodecParameters_color_space_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_chroma_location(ptr: number): Promise<number>;
AVCodecParameters_chroma_location_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_channels(ptr: number): Promise<number>;
AVCodecParameters_channels_s(ptr: number, val: number): Promise<void>;
AVCodecParameters_sample_rate(ptr: number): Promise<number>;
AVCodecParameters_sample_rate_s(ptr: number, val: number): Promise<void>;
AVPacket_pts(ptr: number): Promise<number>;
AVPacket_pts_s(ptr: number, val: number): Promise<void>;
AVPacket_ptshi(ptr: number): Promise<number>;
AVPacket_ptshi_s(ptr: number, val: number): Promise<void>;
AVPacket_dts(ptr: number): Promise<number>;
AVPacket_dts_s(ptr: number, val: number): Promise<void>;
AVPacket_dtshi(ptr: number): Promise<number>;
AVPacket_dtshi_s(ptr: number, val: number): Promise<void>;
AVPacket_data(ptr: number): Promise<number>;
AVPacket_data_s(ptr: number, val: number): Promise<void>;
AVPacket_size(ptr: number): Promise<number>;
AVPacket_size_s(ptr: number, val: number): Promise<void>;
AVPacket_stream_index(ptr: number): Promise<number>;
AVPacket_stream_index_s(ptr: number, val: number): Promise<void>;
AVPacket_flags(ptr: number): Promise<number>;
AVPacket_flags_s(ptr: number, val: number): Promise<void>;
AVPacket_side_data(ptr: number): Promise<number>;
AVPacket_side_data_s(ptr: number, val: number): Promise<void>;
AVPacket_side_data_elems(ptr: number): Promise<number>;
AVPacket_side_data_elems_s(ptr: number, val: number): Promise<void>;
AVPacket_duration(ptr: number): Promise<number>;
AVPacket_duration_s(ptr: number, val: number): Promise<void>;
AVPacket_durationhi(ptr: number): Promise<number>;
AVPacket_durationhi_s(ptr: number, val: number): Promise<void>;
AVFormatContext_nb_streams(ptr: number): Promise<number>;
AVFormatContext_nb_streams_s(ptr: number, val: number): Promise<void>;
AVFormatContext_oformat(ptr: number): Promise<number>;
AVFormatContext_oformat_s(ptr: number, val: number): Promise<void>;
AVFormatContext_pb(ptr: number): Promise<number>;
AVFormatContext_pb_s(ptr: number, val: number): Promise<void>;
AVFormatContext_streams_a(ptr: number, idx: number): Promise<number>;
AVFormatContext_streams_a_s(ptr: number, idx: number, val: number): Promise<void>;
AVStream_codecpar(ptr: number): Promise<number>;
AVStream_codecpar_s(ptr: number, val: number): Promise<void>;
AVStream_duration(ptr: number): Promise<number>;
AVStream_duration_s(ptr: number, val: number): Promise<void>;
AVStream_durationhi(ptr: number): Promise<number>;
AVStream_durationhi_s(ptr: number, val: number): Promise<void>;
AVFilterInOut_filter_ctx(ptr: number): Promise<number>;
AVFilterInOut_filter_ctx_s(ptr: number, val: number): Promise<void>;
AVFilterInOut_name(ptr: number): Promise<number>;
AVFilterInOut_name_s(ptr: number, val: number): Promise<void>;
AVFilterInOut_next(ptr: number): Promise<number>;
AVFilterInOut_next_s(ptr: number, val: number): Promise<void>;
AVFilterInOut_pad_idx(ptr: number): Promise<number>;
AVFilterInOut_pad_idx_s(ptr: number, val: number): Promise<void>;
av_frame_free_js(ptr: number);
av_packet_free_js(ptr: number);
avformat_close_input_js(ptr: number);
avcodec_free_context_js(ptr: number);
avfilter_graph_free_js(ptr: number);
avfilter_inout_free_js(ptr: number);
copyin_u8(ptr: number, arr: Uint8Array): Promise<void>;
copyout_u8(ptr: number, len: number): Promise<Uint8Array>;
copyin_s16(ptr: number, arr: Int16Array): Promise<void>;
copyout_s16(ptr: number, len: number): Promise<Int16Array>;
copyin_s32(ptr: number, arr: Int32Array): Promise<void>;
copyout_s32(ptr: number, len: number): Promise<Int32Array>;
copyin_f32(ptr: number, arr: Float32Array): Promise<void>;
copyout_f32(ptr: number, len: number): Promise<Float32Array>;

/**
 * Read a complete file from the in-memory filesystem.
 * @param name  Filename to read
 */
readFile(name: string): Promise<Uint8Array>;
/**
 * Write a complete file to the in-memory filesystem.
 * @param name  Filename to write
 * @param content  Content to write to the file
 */
writeFile(name: string, content: Uint8Array): Promise<Uint8Array>;
/**
 * Delete a file in the in-memory filesystem.
 * @param name  Filename to delete
 */
unlink(name: string): Promise<void>;
/**
 * Make a reader device.
 * @param name  Filename to create
 * @param mode  Unix permissions (pointless since this is an in-memory
 *              filesystem)
 */
mkreaderdev(name: string, mode?: number): Promise<void>;
/**
 * Make a writer device.
 * @param name  Filename to create
 * @param mode  Unix permissions
 */
mkwriterdev(name: string, mode?: number): Promise<void>;
/**
 * Send some data to a reader device
 * @param name  Filename of the reader device
 * @param data  Data to sending
 */
ff_reader_dev_send(name: string, data: Uint8Array): Promise<void>;
/**
 * Metafunction to determine whether any device has any waiters. This can be
 * used to determine whether more data needs to be sent before a previous step
 * will be fully resolved.
 */
ff_reader_dev_waiting(): Promise<boolean>;
/**
 * Metafunction to initialize an encoder with all the bells and whistles.
 * Returns [AVCodec, AVCodecContext, AVFrame, AVPacket, frame_size]
 * @param name  libav name of the codec
 * @param opts  Encoder options
 */
ff_init_encoder(
    name: string, opts?: {
        ctx?: AVCodecContextProps, options?: Record<string, string>
    }
): Promise<[number, number, number, number, number]>;
/**
 * Metafunction to initialize a decoder with all the bells and whistles.
 * Similar to ff_init_encoder but doesn't need to initialize the frame.
 * Returns [AVCodec, AVCodecContext, AVPacket, AVFrame]
 * @param name  libav decoder identifier or name
 * @param codecpar  Optional AVCodecParameters
 */
ff_init_decoder(
    name: string | number, codecpar?: number
): Promise<[number, number, number, number]>;
/**
 * Free everything allocated by ff_init_encoder.
 * @param c  AVCodecContext
 * @param frame  AVFrame
 * @param pkt  AVPacket
 */
ff_free_encoder(
    c: number, frame: number, pkt: number
): Promise<void>;
/**
 * Free everything allocated by ff_init_decoder
 * @param c  AVCodecContext
 * @param pkt  AVPacket
 * @param frame  AVFrame
 */
ff_free_decoder(
    c: number, pkt: number, frame: number
): Promise<void>;
/**
 * Encode some number of frames at once. Done in one go to avoid excess message
 * passing.
 * @param ctx  AVCodecContext
 * @param frame  AVFrame
 * @param pkt  AVPacket
 * @param inFrames  Array of frames in libav.js format
 * @param fin  Set to true if this is the end of encoding
 */
ff_encode_multi(
    ctx: number, frame: number, pkt: number, inFrames: Frame[],
    fin?: boolean
): Promise<Packet[]>;
/**
 * Decode some number of packets at once. Done in one go to avoid excess
 * message passing.
 * @param ctx  AVCodecContext
 * @param pkt  AVPacket
 * @param frame  AVFrame
 * @param inPackets  Incoming packets to decode
 * @param config  Decoding options. May be "true" to indicate end of stream.
 */
ff_decode_multi(
    ctx: number, pkt: number, frame: number, inPackets: Packet[],
    config?: boolean | {
        fin?: boolean,
        ignoreErrors?: boolean
    }
): Promise<Frame[]>;
/**
 * Initialize a muxer format, format context and some number of streams.
 * Returns [AVFormatContext, AVOutputFormat, AVIOContext, AVStream[]]
 * @param opts  Muxer options
 * @param stramCtxs  Context info for each stream to mux
 */
ff_init_muxer(
    opts: {
        oformat?: number, // format pointer
        format_name?: string, // libav name
        filename?: string,
        device?: boolean, // Create a writer device
        open?: boolean // Open the file for writing
    },
    streamCtxs: [number, number, number][] // AVCodecContext, time_base_num, time_base_den
): Promise<[number, number, number, number[]]>;
/**
 * Free up a muxer format and/or file
 * @param oc  AVFormatContext
 * @param pb  AVIOContext
 */
ff_free_muxer(oc: number, pb: number): Promise<void>;
/**
 * Initialize a demuxer from a file and format context, and get the list of
 * codecs/types.
 * Returns [AVFormatContext, Stream[]]
 * @param filename  Filename to open
 * @param fmt  Format to use (optional)
 */
ff_init_demuxer_file(
    filename: string, fmt?: string
): Promise<[number, Stream[]]>;
/**
 * Write some number of packets at once.
 * @param oc  AVFormatContext
 * @param pkt  AVPacket
 * @param inPackets  Packets to write
 * @param interleave  Set to false to *not* use the interleaved writer.
 *                    Interleaving is the default.
 */
ff_write_multi(
    oc: number, pkt: number, inPackets: Packet[], interleave?: boolean
): Promise<void>;
/**
 * Read many packets at once. If you don't set any limits, this function will
 * block (asynchronously) until the whole file is read, so make sure you set
 * some limits if you want to read a bit at a time. Returns a pair [result,
 * packets], where the result indicates whether an error was encountered, an
 * EOF, or simply limits (EAGAIN), and packets is a dictionary indexed by the
 * stream number in which each element is an array of packets from that stream.
 * @param fmt_ctx  AVFormatContext
 * @param pkt  AVPacket
 * @param devfile  Name of the device file being read from, if applicable. Used
 *                 to set limits on when to read based on available data.
 * @param opts  Other options
 */
ff_read_multi(
    fmt_ctx: number, pkt: number, devfile?: string, opts?: {
        limit?: number, // OUTPUT limit, in bytes
        devLimit?: number // INPUT limit, in bytes (don't read if less than this much data is available)
    }
): Promise<[number, Record<number, Packet[]>]>;
/**
 * Initialize a filter graph. No equivalent free since you just need to free
 * the graph itself (av_filter_graph_free) and everything under it will be
 * freed automatically.
 * Returns [AVFilterGraph, AVFilterContext, AVFilterContext], where the second
 * and third are the input and output buffer source/sink. For multiple
 * inputs/outputs, the second and third will be arrays, as appropriate.
 * @param filters_descr  Filtergraph description
 * @param input  Input settings, or array of input settings for multiple inputs
 * @param output  Output settings, or array of output settings for multiple
 *                outputs
 */
ff_init_filter_graph(
    filters_descr: string,
    input: FilterIOSettings,
    output: FilterIOSettings
): Promise<[number, number, number]>;
ff_init_filter_graph(
    filters_descr: string,
    input: FilterIOSettings[],
    output: FilterIOSettings
): Promise<[number, number[], number]>;
ff_init_filter_graph(
    filters_descr: string,
    input: FilterIOSettings,
    output: FilterIOSettings[]
): Promise<[number, number, number[]]>;
ff_init_filter_graph(
    filters_descr: string,
    input: FilterIOSettings[],
    output: FilterIOSettings[]
): Promise<[number, number[], number[]]>;
/**
 * Filter some number of frames, possibly corresponding to multiple sources.
 * @param srcs  AVFilterContext(s), input
 * @param buffersink_ctx  AVFilterContext, output
 * @param framePtr  AVFrame
 * @param inFrames  Input frames, either as an array of frames or with frames
 *                  per input
 * @param fin  Indicate end-of-stream(s)
 */
ff_filter_multi(
    srcs: number, buffersink_ctx: number, framePtr: number,
    inFrames: Frame[], fin?: boolean
): Promise<Frame[]>;
ff_filter_multi(
    srcs: number[], buffersink_ctx: number, framePtr: number,
    inFrames: Frame[][], fin?: boolean[]
): Promise<Frame[]>;
/**
 * Copy out a frame.
 * @param frame  AVFrame
 */
ff_copyout_frame(frame: number): Promise<Frame>;
/**
 * Copy in a frame.
 * @param framePtr  AVFrame
 * @param frame  Frame to copy in
 */
ff_copyin_frame(framePtr: number, frame: Frame): Promise<void>;
/**
 * Copy out a packet.
 * @param pkt  AVPacket
 */
ff_copyout_packet(pkt: number): Promise<Packet>;
/**
 * Copy in a packet.
 * @param pktPtr  AVPacket
 * @param packet  Packet to copy in.
 */
ff_copyin_packet(pktPtr: number, packet: Packet): Promise<void>;
/**
 * Allocate and copy in a 32-bit int list.
 * @param list  List of numbers to copy in
 */
ff_malloc_int32_list(list: number[]): Promise<number>;
/**
 * Allocate and copy in a 64-bit int list.
 * @param list  List of numbers to copy in
 */
ff_malloc_int64_list(list: number[]): Promise<number>;


    /**
     * Callback when writes occur. Set by the user.
     */
    onwrite?: (filename: string, position: number, buffer: Uint8Array | Int8Array) => void;

    /**
     * Terminate the worker associated with this libav.js instance, rendering
     * it inoperable and freeing its memory.
     */
    terminate(): void;

    // Enumerations:
    AV_OPT_SEARCH_CHILDREN: number;
    AVMEDIA_TYPE_UNKNOWN: number;
    AVMEDIA_TYPE_VIDEO: number;
    AVMEDIA_TYPE_AUDIO: number;
    AVMEDIA_TYPE_DATA: number;
    AVMEDIA_TYPE_SUBTITLE: number;
    AVMEDIA_TYPE_ATTACHMENT: number;
    AV_SAMPLE_FMT_NONE: number;
    AV_SAMPLE_FMT_U8: number;
    AV_SAMPLE_FMT_S16: number;
    AV_SAMPLE_FMT_S32: number;
    AV_SAMPLE_FMT_FLT: number;
    AV_SAMPLE_FMT_DBL: number;
    AV_SAMPLE_FMT_U8P: number;
    AV_SAMPLE_FMT_S16P: number;
    AV_SAMPLE_FMT_S32P: number;
    AV_SAMPLE_FMT_FLTP: number;
    AV_SAMPLE_FMT_DBLP: number;
    AV_SAMPLE_FMT_S64: number;
    AV_SAMPLE_FMT_S64P: number;
    AV_SAMPLE_FMT_NB: number;
    AV_PIX_FMT_NONE: number;
    AV_PIX_FMT_YUV420P: number;
    AV_PIX_FMT_YUYV422: number;
    AV_PIX_FMT_RGB24: number;
    AV_PIX_FMT_BGR24: number;
    AV_PIX_FMT_YUV422P: number;
    AV_PIX_FMT_YUV444P: number;
    AV_PIX_FMT_YUV410P: number;
    AV_PIX_FMT_YUV411P: number;
    AV_PIX_FMT_GRAY8: number;
    AV_PIX_FMT_MONOWHITE: number;
    AV_PIX_FMT_MONOBLACK: number;
    AV_PIX_FMT_PAL8: number;
    AV_PIX_FMT_YUVJ420P: number;
    AV_PIX_FMT_YUVJ422P: number;
    AV_PIX_FMT_YUVJ444P: number;
    AV_PIX_FMT_UYVY422: number;
    AV_PIX_FMT_UYYVYY411: number;
    AV_PIX_FMT_BGR8: number;
    AV_PIX_FMT_BGR4: number;
    AV_PIX_FMT_BGR4_BYTE: number;
    AV_PIX_FMT_RGB8: number;
    AV_PIX_FMT_RGB4: number;
    AV_PIX_FMT_RGB4_BYTE: number;
    AV_PIX_FMT_NV12: number;
    AV_PIX_FMT_NV21: number;
    AV_PIX_FMT_ARGB: number;
    AV_PIX_FMT_RGBA: number;
    AV_PIX_FMT_ABGR: number;
    AV_PIX_FMT_BGRA: number;
    AV_PIX_FMT_GRAY16BE: number;
    AV_PIX_FMT_GRAY16LE: number;
    AV_PIX_FMT_YUV440P: number;
    AV_PIX_FMT_YUVJ440P: number;
    AV_PIX_FMT_YUVA420P: number;
    AV_PIX_FMT_RGB48BE: number;
    AV_PIX_FMT_RGB48LE: number;
    AV_PIX_FMT_RGB565BE: number;
    AV_PIX_FMT_RGB565LE: number;
    AV_PIX_FMT_RGB555BE: number;
    AV_PIX_FMT_RGB555LE: number;
    AV_PIX_FMT_BGR565BE: number;
    AV_PIX_FMT_BGR565LE: number;
    AV_PIX_FMT_BGR555BE: number;
    AV_PIX_FMT_BGR555LE: number;
    AVIO_FLAG_READ: number;
    AVIO_FLAG_WRITE: number;
    AVIO_FLAG_READ_WRITE: number;
    AVIO_FLAG_NONBLOCK: number;
    AVIO_FLAG_DIRECT: number;
    EAGAIN: number;
    AVERROR_EOF: number;
}

export interface LibAVWrapper {
    /**
     * URL base from which load workers and modules.
     */
    base: string;

    /**
     * Create a LibAV instance.
     * @param opts  Options
     */
    LibAV(opts?: {
        noworker?: boolean,
        nowasm?: boolean
    }): Promise<LibAV>;
}
