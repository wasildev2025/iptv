package com.iptv.player.di

import android.content.Context
import androidx.room.Room
import com.iptv.player.BuildConfig
import com.iptv.player.data.api.IPTVApiService
import com.iptv.player.data.auth.DeviceTokenInterceptor
import com.iptv.player.data.db.AppDatabase
import com.iptv.player.data.db.ChannelCacheDao
import com.iptv.player.data.db.EpgDao
import com.iptv.player.data.db.FavoriteDao
import com.iptv.player.data.db.RecentDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(
        deviceTokenInterceptor: DeviceTokenInterceptor
    ): OkHttpClient {
        return OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(deviceTokenInterceptor)
            .addInterceptor(
                HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BODY
                }
            )
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL + "/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideApiService(retrofit: Retrofit): IPTVApiService {
        return retrofit.create(IPTVApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "iptv_player.db"
        )
        .fallbackToDestructiveMigration()
        .build()
    }

    @Provides fun provideFavoriteDao(db: AppDatabase): FavoriteDao = db.favoriteDao()
    @Provides fun provideRecentDao(db: AppDatabase): RecentDao = db.recentDao()
    @Provides fun provideChannelCacheDao(db: AppDatabase): ChannelCacheDao = db.channelCacheDao()
    @Provides fun provideEpgDao(db: AppDatabase): EpgDao = db.epgDao()
}
