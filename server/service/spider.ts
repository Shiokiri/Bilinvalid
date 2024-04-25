import axios from "axios";
import { sleep } from "@/lib/utils";
import db from "@/lib/db";

export const config = {
  cookie: process.env.COOKIE || "",
  userAgent: process.env.USER_AGENT || "",
  upperMid: process.env.UPPER_MID || "",
  timeout: 5000,
  delay: 5000,
};

const request = axios.create({
  timeout: config.timeout,
  headers: { Cookie: config.cookie, "User-Agent": config.userAgent },
});

const api = {
  listAllFavorite: async () => {
    try {
      const response = await request.get(
        `https://api.bilibili.com/x/v3/fav/folder/created/list-all`,
        {
          params: {
            up_mid: config.upperMid,
          },
        }
      );
      return response.data.data;
    } catch (error) {
      console.error(error);
    }
  },
  getFavoriteMetadata: async (media_id: number) => {
    try {
      const response = await request.get(
        `https://api.bilibili.com/x/v3/fav/folder/info`,
        {
          params: {
            media_id,
          },
        }
      );
      return response.data.data;
    } catch (error) {
      console.error(error);
    }
  },
  getFavoriteContent: async (media_id: number, pn: number) => {
    try {
      const response = await request.get(
        `https://api.bilibili.com/x/v3/fav/resource/list`,
        {
          params: {
            media_id,
            ps: 20,
            pn,
          },
        }
      );
      return response.data.data;
    } catch (error) {
      console.error(error);
    }
  },
};

const saveFavoritesWithMetadataToDatabase = async (
  favoritesWithMetadata: any
) => {
  // 删除已经不存在的收藏夹 开始
  const favoriteIdsSet = new Set<BigInt>();
  for (const favorite of favoritesWithMetadata) {
    favoriteIdsSet.add(BigInt(favorite.id));
  }
  const favorites = await db.favorite.findMany();
  for (const favorite of favorites) {
    if (!favoriteIdsSet.has(favorite.id)) {
      await db.favorite.delete({
        where: {
          id: favorite.id,
        },
      });
    }
  }
  // 删除已经不存在的收藏夹 结束
  for (const [index, favorite] of favoritesWithMetadata.entries()) {
    const data = {
      fid: favorite.fid,
      mid: favorite.mid,
      attr: favorite.attr,
      title: favorite.title,
      cover: favorite.cover,
      upperMid: favorite.upper.mid,
      upperName: favorite.upper.name,
      upperFace: favorite.upper.face,
      upperFollowed: favorite.upper.followed,
      upperVipType: favorite.upper.vip_type,
      upperVipStatue: favorite.upper.vip_statue,
      coverType: favorite.cover_type,
      collect: favorite.cnt_info.collect,
      play: favorite.cnt_info.play,
      thumbUp: favorite.cnt_info.thumb_up,
      share: favorite.cnt_info.share,
      type: favorite.type,
      intro: favorite.intro,
      ctime: new Date(favorite.ctime * 1000),
      mtime: new Date(favorite.mtime * 1000),
      state: favorite.state,
      favState: favorite.fav_state,
      likeState: favorite.like_state,
      mediaCount: favorite.media_count,
      index,
    };
    await db.favorite.upsert({
      where: {
        id: favorite.id,
      },
      update: {
        ...data,
      },
      create: {
        ...data,
        id: favorite.id,
      },
    });
  }
};

const saveFavoriteContentToDatabase = async (favoriteContent: any) => {
  // 删除已经不存在的收藏夹视频关系 开始
  const mediasInFavorite = await db.favorite.findUnique({
    where: {
      id: favoriteContent.info.id,
    },
    include: {
      medias: true,
    },
  });
  if (mediasInFavorite && mediasInFavorite.medias.length > 0) {
    const mediaIdsSet = new Set<BigInt>();
    for (const media of favoriteContent.medias) {
      mediaIdsSet.add(BigInt(media.id));
    }
    for (const media of mediasInFavorite.medias) {
      if (!mediaIdsSet.has(media.mid)) {
        await db.mediasInFavorites.delete({
          where: {
            mid_fid: {
              fid: favoriteContent.info.id,
              mid: media.mid,
            },
          },
        });
      }
    }
  }
  // 删除已经不存在的收藏夹视频关系 结束
  for (const media of favoriteContent.medias) {
    const data = {
      type: media.type,
      intro: media.intro,
      page: media.page,
      duration: media.duration,
      upperMid: media.upper.mid,
      upperName: media.upper.name,
      upperFace: media.upper.face,
      attr: media.attr,
      collect: media.cnt_info.collect,
      play: media.cnt_info.play,
      danmaku: media.cnt_info.danmaku,
      link: media.link,
      ctime: new Date(media.ctime * 1000),
      pubtime: new Date(media.pubtime * 1000),
      bvid: media.bvid,
    };
    await db.media.upsert({
      where: {
        id: media.id,
      },
      update: {
        ...data,
      },
      create: {
        ...data,
        id: media.id,
        title: media.title, // title 会失效
        cover: media.cover, // cover 会失效
      },
    });
    const relation = await db.mediasInFavorites.findUnique({
      where: {
        mid_fid: {
          fid: favoriteContent.info.id,
          mid: media.id,
        },
      },
    });
    if (relation) {
      await db.mediasInFavorites.update({
        where: {
          mid_fid: {
            fid: favoriteContent.info.id,
            mid: media.id,
          },
        },
        data: {
          favtime: new Date(media.fav_time * 1000),
        },
      });
    } else {
      await db.mediasInFavorites.create({
        data: {
          fid: favoriteContent.info.id,
          mid: media.id,
          favtime: new Date(media.fav_time * 1000),
        },
      });
    }
  }
};

const saveFavoriteContent = async (media_id: number, media_count: number) => {
  const favoriteContent = Object.values(
    await Promise.all(
      Array.from({ length: Math.ceil(media_count / 20) }).map((_, index) =>
        api.getFavoriteContent(media_id, index + 1)
      )
    )
  );
  const mediasInFavorite = {
    info: favoriteContent[0].info,
    medias: favoriteContent.reduce(
      (acc, content) => [...acc, ...content.medias],
      []
    ),
  };

  // save favoriteContent to database
  await saveFavoriteContentToDatabase(mediasInFavorite);
};

const saveFavorite = async () => {
  const favorites = await api.listAllFavorite();
  const favoritesWithMetadata = await Promise.all(
    favorites.list.map((favorite: { id: number }) =>
      api.getFavoriteMetadata(favorite.id)
    )
  );

  // save favoritesWithMetadata to database
  await saveFavoritesWithMetadataToDatabase(favoritesWithMetadata);

  for (const favorite of favoritesWithMetadata) {
    await saveFavoriteContent(favorite.id, favorite.media_count);
    console.log(`Medias in favorite:${favorite.id}. have been saved.`);
    await sleep(config.delay);
  }
};

export default saveFavorite;
